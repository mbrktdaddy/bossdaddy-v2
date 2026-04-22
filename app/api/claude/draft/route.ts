import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, MODEL, BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { generateAndUploadImage } from '@/lib/images/dalle'
import { z } from 'zod'

export const maxDuration = 90

const DraftInput = z.object({
  productName: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  keyFeatures: z.array(z.string()).min(1).max(10),
  targetAudience: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productName, category, keyFeatures, targetAudience } = parsed.data

  const prompt = `Write a product review:

Product: ${productName}
Category: ${category}
Key Features: ${keyFeatures.join(', ')}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}

STRUCTURE REQUIREMENTS:
- Introduction: 2–3 sentences that open with a real testing scenario (first-person dad)
- Sections: 3–5 sections, each 150–250 words covering different aspects (performance, design, value, family use, etc.)
- Separate paragraphs within each section with \\n\\n
- Verdict: 1–2 paragraphs with a clear buy/skip recommendation
- Pros: 3–6 short, specific items (not vague — "12V battery lasted 4 hours" not "long battery")
- Cons: 2–4 honest, specific items — never skip the cons
- Rating: honest 1–10 score; reserve 9+ for truly exceptional products

SEO: Include the product name naturally in the intro and at least one section heading.

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
  "imagePrompt": "string (DALL-E 3 prompt: the product in a realistic setting, natural or warm lighting, clean composition, no people, no text, under 180 chars, style: editorial product photography)"
}`

  try {
    const claude = getClaudeClient()
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 2500,
      system: [
        {
          type: 'text',
          text: BOSS_DADDY_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })
    }

    const draft = JSON.parse(jsonMatch[0])

    const heroPrompt: string = draft.imagePrompt ?? `Photorealistic product photo of the ${productName} on a clean surface, natural lighting, no people`
    const heroResult = await Promise.allSettled([
      generateAndUploadImage(heroPrompt, 'review-images', '1792x1024'),
    ])
    const heroUrl = heroResult[0].status === 'fulfilled' ? heroResult[0].value : null

    const { imagePrompt: _omit, ...cleanDraft } = draft

    return NextResponse.json({ draft: cleanDraft, images: { heroUrl }, remaining })
  } catch (err) {
    console.error('Claude draft error:', err)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 502 })
  }
}
