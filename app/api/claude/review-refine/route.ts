import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { buildBossDaddySystemBlocks } from '@/lib/voiceProfile'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

export const maxDuration = 60

const RefineInput = z.object({
  title:        z.string().min(1).max(120),
  product_name: z.string().min(1).max(120),
  category:     z.string().min(1).max(80),
  content:      z.string().min(10),
  instruction:  z.string().min(4).max(1000),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(`refine:${user.id}`, 'refine')
  if (!rl.success) return NextResponse.json({ error: 'Too many refinements. Try again in an hour.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = RefineInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, product_name, category, content, instruction } = parsed.data

  // Extract product slug from any resolved affiliate anchor so token placement
  // rules survive a refine cycle (resolved <a data-product-slug> → [[BUY:slug]])
  const slugMatch = content.match(/data-product-slug="([^"]+)"/)
  const productSlug = slugMatch?.[1] ?? null

  const plainText = content
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const prompt = `You are editing an existing Boss Daddy product review. Apply ONLY the requested changes — preserve everything else.

Title: ${title}
Product: ${product_name}
Category: ${category}${productSlug ? `\nProduct slug: ${productSlug}` : ''}

Current review text:
${plainText}

Refinement instructions: ${instruction}

Return JSON with this exact shape:
{
  "title": "string — updated title if instructions require it, otherwise keep original",
  "excerpt": "string — updated excerpt if needed, max 160 chars",
  "introduction": "string",
  "sections": [
    { "heading": "string", "body": "string" }
  ],
  "verdict": "string",
  "rating": number (1-10),
  "pros": ["string"],
  "cons": ["string"]
}

Important: Only change what the instructions specify. Keep the first-person dad voice throughout.`

  try {
    const claude = getClaudeClient()
    const systemBlocks = await buildBossDaddySystemBlocks(supabase, user.id)
    const message = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system: systemBlocks,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })

    const draft = JSON.parse(jsonMatch[0])
    return NextResponse.json({ draft })
  } catch (err) {
    console.error('Review refine error:', err)
    return NextResponse.json({ error: 'Refinement failed' }, { status: 502 })
  }
}
