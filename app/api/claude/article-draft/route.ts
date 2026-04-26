import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

const ArticleDraftInput = z.object({
  topic: z.string().min(4).max(150),
  category: z.string().min(2).max(80),
  keyPoints: z.array(z.string()).max(15).default([]),
  targetAudience: z.string().max(200).optional(),
  productSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(15).optional(),
  // 'auto' lets Claude pick (2–3 images); a number forces exactly that many.
  imageSlots: z.union([z.literal('auto'), z.number().int().min(0).max(6)]).default('auto'),
})

function inlineImagesInstruction(slots: number | 'auto'): string {
  if (slots === 0) {
    return 'INLINE IMAGES:\n- Do not include any inline images. Return an empty array for "inlineImages".'
  }
  if (slots === 'auto') {
    return `INLINE IMAGES:
- Suggest 2–3 inline image placements that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
  }
  return `INLINE IMAGES:
- Suggest exactly ${slots} inline image placement${slots === 1 ? '' : 's'} that would meaningfully improve the article. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short editorial sentence readers see under the image — human, not a restatement of the alt. Under 100 chars.`
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, remaining, reset } = await checkRateLimit(`article-draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      { status: 429, headers: { 'X-RateLimit-Remaining': String(remaining), 'X-RateLimit-Reset': String(reset) } }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = ArticleDraftInput.safeParse(body)
  if (!parsed.success) {
    console.error('article-draft validation failed:', parsed.error.flatten())
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { topic, category, keyPoints, targetAudience, productSlugs, imageSlots } = parsed.data
  const slugs = (productSlugs ?? []).filter(Boolean)

  const prompt = `Write a dad-focused article on this topic:

Topic: ${topic}
Category: ${category}${keyPoints.length ? `\nKey Points: ${keyPoints.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${slugs.length ? `\nProduct slugs: ${slugs.join(', ')}` : ''}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that hook the reader with a real scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words, with a clear practical takeaway
- Conclusion: 1–2 paragraphs with a specific next step or recommendation
- Separate paragraphs within each section with \\n\\n

SEO: Include the main topic phrase naturally in the intro and at least one section heading.

${inlineImagesInstruction(imageSlots)}

Return JSON with this exact shape:
{
  "title": "string (specific, useful title — max 80 chars, include the topic keyword)",
  "excerpt": "string (one punchy sentence for the article card — max 160 chars)",
  "introduction": "string (2–3 sentences, first-person dad opening a real situation)",
  "sections": [
    { "heading": "string (clear, action-oriented heading)", "body": "string (150–250 words, paragraphs separated by \\n\\n)" }
  ],
  "conclusion": "string (1–2 paragraphs with a clear next step, separated by \\n\\n if 2 paragraphs)",
  "heroImagePrompt": "string (DALL-E 3 prompt for the hero image: specific real-world objects, natural daylight or warm indoor light, no people, no text, under 180 chars, style: editorial photography)",
  "inlineImages": [
    { "afterHeading": "string (must match one of the section headings above)", "prompt": "string", "altText": "string", "caption": "string" }
  ]
}`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  const claudeResult = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  }).catch((err: unknown) => {
    console.error('Claude API error (article-draft):', err)
    return { _error: err instanceof Error ? err.message : String(err) } as const
  })

  if ('_error' in claudeResult) {
    const msg = claudeResult._error
    const isTimeout = /timeout|timed.?out|deadline/i.test(msg)
    const isOverload = /overload|529|capacity/i.test(msg)
    return NextResponse.json({
      error: isTimeout
        ? 'Generation timed out — the AI is busy. Please wait a moment and try again.'
        : isOverload
        ? 'The AI service is currently overloaded. Please try again in a minute.'
        : `AI service error: ${msg.slice(0, 120)}`,
    }, { status: 502 })
  }

  const text = claudeResult.content.find((b) => b.type === 'text')?.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return NextResponse.json({ error: 'AI returned an unexpected format — please try again.' }, { status: 502 })
  }

  let draft: Record<string, unknown>
  try {
    draft = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'AI returned malformed content — please try again.' }, { status: 502 })
  }

  // Extract the hero image prompt — return it so the form can pre-fill the
  // editable prompt field. Inline image prompts travel with the draft itself.
  const imagePrompt: string = (draft.heroImagePrompt as string)
    ?? (draft.imagePrompts as Record<string, string> | undefined)?.hero
    ?? `Photorealistic lifestyle photo for a dad-focused article about ${topic}, no people, objects and setting only`

  const { heroImagePrompt: _heroOmit, imagePrompts: _legacyOmit, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, imagePrompt, remaining })
}
