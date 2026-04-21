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

  const prompt = `Write a review for the following product:

Product: ${productName}
Category: ${category}
Key Features: ${keyFeatures.join(', ')}${targetAudience ? `\nTarget Audience: ${targetAudience}` : ''}

Return JSON with this exact shape:
{
  "title": "string (compelling SEO-friendly title, max 70 chars)",
  "introduction": "string (2-3 sentences hooking the reader, first person dad voice)",
  "sections": [
    { "heading": "string", "body": "string (2-4 paragraphs)" }
  ],
  "verdict": "string (1-2 paragraph summary with recommendation)",
  "rating": number (1-10 scale, decimals ok e.g. 8.5),
  "pros": ["string"],
  "cons": ["string"],
  "imagePrompt": "string (DALL-E 3 prompt — write as if describing a stock photo of the product: the product in a real-world setting, natural or warm lighting, clean composition, no people, no text, no artistic effects, under 200 chars. Style: editorial product photography.)"
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
