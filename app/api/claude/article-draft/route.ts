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

  const prompt = `Write a helpful dad-focused article on the following topic:

Topic: ${topic}
Category: ${category}
Key Points to Cover: ${keyPoints.join(', ')}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}

Return JSON with this exact shape:
{
  "title": "string (compelling, specific title — max 80 chars)",
  "excerpt": "string (1-2 sentence hook for the article card — max 160 chars)",
  "introduction": "string (2-3 engaging opening sentences in first-person dad voice)",
  "sections": [
    { "heading": "string", "body": "string (2-3 paragraphs of useful content)" }
  ],
  "conclusion": "string (1-2 paragraph wrap-up with a clear takeaway or next step)",
  "imagePrompts": {
    "hero": "string (DALL-E 3 prompt — write as if describing a stock photo: specific objects, real-world setting, natural daylight or warm indoor lighting, clean uncluttered composition, no people, no text, under 200 chars. Style: editorial photography, not illustration or fantasy.)",
    "sections": ["string", ...] (one prompt per section — same stock-photo rules: real objects in realistic settings, natural lighting, no people, no text, no artistic effects, under 200 chars each)
  }
}`

  try {
    const claude = getClaudeClient()
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: [{ type: 'text', text: BOSS_DADDY_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })
    }

    const draft = JSON.parse(jsonMatch[0])

    // Generate hero + section images in parallel (cap sections at 3)
    const heroPrompt: string = draft.imagePrompts?.hero ?? `Photorealistic lifestyle photo for a dad-focused article about ${topic}, no people, objects and setting only`
    const sectionPrompts: string[] = (draft.imagePrompts?.sections ?? []).slice(0, 3)

    const results = await Promise.allSettled([
      generateAndUploadImage(heroPrompt, 'article-images', '1792x1024'),
      ...sectionPrompts.map((p: string) => generateAndUploadImage(p, 'article-images', '1024x1024')),
    ])

    const [heroResult, ...sectionResults] = results
    const heroUrl = heroResult.status === 'fulfilled' ? heroResult.value : null
    const sectionUrls = sectionResults
      .map(r => (r.status === 'fulfilled' ? r.value : null))
      .filter((u): u is string => u !== null)

    // Strip imagePrompts from draft before returning — not needed by client
    const { imagePrompts: _omit, ...cleanDraft } = draft

    return NextResponse.json({ draft: cleanDraft, images: { heroUrl, sectionUrls }, remaining })
  } catch (err) {
    console.error('Article draft error:', err)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 502 })
  }
}
