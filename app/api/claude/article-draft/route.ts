import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, MODEL, BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateAndUploadImage } from '@/lib/images/dalle'
import { z } from 'zod'

export const maxDuration = 90

const ArticleDraftInput = z.object({
  topic: z.string().min(4).max(150),
  category: z.string().min(2).max(80),
  keyPoints: z.array(z.string()).min(1).max(10),
  targetAudience: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { topic, category, keyPoints, targetAudience } = parsed.data

  const prompt = `Write a dad-focused article on this topic:

Topic: ${topic}
Category: ${category}
Key Points: ${keyPoints.join(', ')}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that hook the reader with a real scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words, with a clear practical takeaway
- Conclusion: 1–2 paragraphs with a specific next step or recommendation
- Separate paragraphs within each section with \\n\\n

SEO: Include the main topic phrase naturally in the intro and at least one section heading.

Return JSON with this exact shape:
{
  "title": "string (specific, useful title — max 80 chars, include the topic keyword)",
  "excerpt": "string (one punchy sentence for the article card — max 160 chars)",
  "introduction": "string (2–3 sentences, first-person dad opening a real situation)",
  "sections": [
    { "heading": "string (clear, action-oriented heading)", "body": "string (150–250 words, paragraphs separated by \\n\\n)" }
  ],
  "conclusion": "string (1–2 paragraphs with a clear next step, separated by \\n\\n if 2 paragraphs)",
  "imagePrompts": {
    "hero": "string (DALL-E 3 prompt: specific real-world objects, natural daylight or warm indoor light, clean composition, no people, no text, under 180 chars, style: editorial photography)",
    "sections": ["string"] (one prompt for the first section only — same photo-realistic rules, no people, no text, under 180 chars)
  }
}`

  const claudeResult = await getClaudeClient().messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: [{ type: 'text', text: BOSS_DADDY_SYSTEM, cache_control: { type: 'ephemeral' } }],
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

  // Generate hero + section images in parallel (cap sections at 1)
  const heroPrompt: string = (draft.imagePrompts as Record<string, string>)?.hero ?? `Photorealistic lifestyle photo for a dad-focused article about ${topic}, no people, objects and setting only`
  const sectionPrompts: string[] = ((draft.imagePrompts as Record<string, string[]>)?.sections ?? []).slice(0, 1)

  const results = await Promise.allSettled([
    generateAndUploadImage(heroPrompt, 'article-images', '1792x1024'),
    ...sectionPrompts.map((p: string) => generateAndUploadImage(p, 'article-images', '1024x1024')),
  ])

  const [heroResult, ...sectionResults] = results
  const heroUrl = heroResult.status === 'fulfilled' ? heroResult.value : null
  const sectionUrls = sectionResults
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((u): u is string => u !== null)

  const warnings: string[] = []
  if (heroResult.status === 'rejected') {
    console.error('Hero image failed (article-draft):', heroResult.reason)
    warnings.push('Hero image could not be generated — use the "Regenerate Image" button after saving.')
  }

  // Strip imagePrompts from draft before returning
  const { imagePrompts: _omit, ...cleanDraft } = draft

  return NextResponse.json({ draft: cleanDraft, images: { heroUrl, sectionUrls }, warnings, remaining })
}
