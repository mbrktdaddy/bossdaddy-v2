import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getClaudeClient, MODEL, BOSS_DADDY_SYSTEM } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 60

const DraftInput = z.object({
  productName: z.string().min(2).max(120),
  category: z.string().min(2).max(80),
  keyFeatures: z.array(z.string()).min(1).max(10),
  targetAudience: z.string().max(200).optional(),
})

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by user ID
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

  // Validate input
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
  "cons": ["string"]
}`

  try {
    const claude = getClaudeClient()
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: BOSS_DADDY_SYSTEM,
          cache_control: { type: 'ephemeral' }, // Cache the system prompt
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''

    // Extract JSON — handle cases where Claude wraps in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })
    }

    const draft = JSON.parse(jsonMatch[0])
    return NextResponse.json({ draft, remaining })
  } catch (err) {
    console.error('Claude draft error:', err)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 502 })
  }
}
