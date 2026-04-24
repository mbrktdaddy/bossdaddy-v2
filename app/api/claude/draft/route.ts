import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 90

const DraftInput = z.object({
  productName: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  keyFeatures: z.array(z.string()).max(15).default([]),
  targetAudience: z.string().max(200).optional(),
  productSlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success, remaining, reset } = await checkRateLimit(`draft:${user.id}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. You can generate 10 drafts per hour.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
        },
      }
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = DraftInput.safeParse(body)
  if (!parsed.success) {
    console.error('review-draft validation failed. body:', JSON.stringify(body), 'errors:', JSON.stringify(parsed.error.flatten()))
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productName, category, keyFeatures, targetAudience, productSlug } = parsed.data

  const prompt = `Write a product review:

Product: ${productName}
Category: ${category}${keyFeatures.length ? `\nKey Features: ${keyFeatures.join(', ')}` : ''}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}${productSlug ? `\nProduct slug: ${productSlug}` : ''}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that open with a real testing scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words covering different aspects (performance, design, value, family use, etc.)
- Separate paragraphs within each section with \\n\\n
- Verdict: 1–2 paragraphs with a clear buy/skip recommendation
- Pros: 3–6 short, specific items (not vague — "12V battery lasted 4 hours" not "long battery")
- Cons: 2–4 honest, specific items — never skip the cons
- Rating: honest 1–10 score; reserve 9+ for truly exceptional products

SEO: Include the product name naturally in the intro and at least one section heading.

INLINE IMAGES:
- Suggest 2–3 inline image placements that would meaningfully improve the review. Each maps to a section heading you also generated above (use the exact heading text in "afterHeading").
- Prompt style: editorial product photography, warm/natural lighting, realistic setting, no people, no text. Under 180 chars.
- "altText" is the a11y description of the image (what a reader would describe if it were rendered). Keep under 120 chars.
- "caption" is a short sentence the reader sees under the image — human, editorial, not a re-statement of the alt text. Under 100 chars.

Return JSON with this exact shape:
{
  "title": "string (SEO title including product name, max 70 chars — e.g. 'DeWalt 20V Drill Review: Built for Real Dad Projects')",
  "excerpt": "string (one punchy sentence for the card — max 160 chars)",
  "introduction": "string (2–3 sentences, first-person dad opening with a real use case)",
  "sections": [
    { "heading": "string (clear heading)", "body": "string (150–250 words, paragraphs separated by \\n\\n)" }
  ],
  "verdict": "string (1–2 paragraphs, clear recommendation, separated by \\n\\n if 2 paragraphs)",
  "rating": number (1–10, decimals ok),
  "pros": ["string"],
  "cons": ["string"],
  "imagePrompt": "string (DALL-E 3 prompt: the product in a realistic setting, natural or warm lighting, clean composition, no people, no text, under 180 chars, style: editorial product photography)",
  "inlineImages": [
    { "afterHeading": "string (must match one of the section headings above)", "prompt": "string", "altText": "string", "caption": "string" }
  ]
}`

  const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
  const claudeResult = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 2500,
    system: systemBlocks,
    messages: [{ role: 'user', content: prompt }],
  }).catch((err: unknown) => {
    console.error('Claude API error (review-draft):', err)
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

  // Extract the AI-suggested image prompt — return it so the form can pre-fill
  // the editable prompt field. Images are generated separately.
  const imagePrompt: string = (draft.imagePrompt as string)
    ?? `Photorealistic product photo of the ${productName} on a clean surface, natural lighting, no people`

  const { imagePrompt: _omit, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, imagePrompt, remaining })
}
