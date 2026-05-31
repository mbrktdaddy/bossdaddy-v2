import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSpecTemplate } from '@/lib/spec-templates'
import { z } from 'zod'

export const maxDuration = 30

const Input = z.object({
  category: z.string().max(80).optional(),
  rawText:  z.string().min(10).max(6000),
})

const PRODUCT_FACTS_SYSTEM = `You extract structured product facts from manufacturer/retailer copy for an affiliate review site.
Return valid JSON only — no markdown, no code fences, no commentary.
Rules:
- Extract ONLY facts explicitly supported by the supplied text. NEVER invent, infer, or estimate a value. If something isn't stated, omit it.
- Prefer the provided preferred labels when the text contains that information, so specs line up across products. Add extra specs only when clearly stated and genuinely useful.
- Values must be concise (a few words, with units) — not sentences.
- "brand" is the manufacturer/brand name only (e.g. "DeWalt"), or null if not clearly stated.`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Product facts are an admin-only authoring tool (the product form is admin-gated).
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { success } = await checkRateLimit(`product-facts:${user.id}`, 'claude-aux')
  if (!success) return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { category, rawText } = parsed.data
  const preferredLabels = getSpecTemplate(category).map((f) => f.label)

  const prompt = `Extract the brand and product specs from the text below.

Preferred spec labels (use these exact labels when the info is present): ${preferredLabels.join(', ')}

Return JSON with this exact shape:
{
  "brand": "string or null",
  "specs": [ { "label": "string", "value": "string" } ]
}

TEXT:
"""
${rawText}
"""`

  try {
    const message = await getClaudeClient().messages.create({
      model: MODEL,
      max_tokens: 800,
      system: [{ type: 'text', text: PRODUCT_FACTS_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content.find((b) => b.type === 'text')?.text ?? ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Model returned unexpected format' }, { status: 502 })

    const parsedOut = JSON.parse(jsonMatch[0]) as { brand?: unknown; specs?: unknown }

    const brand = typeof parsedOut.brand === 'string' && parsedOut.brand.trim() ? parsedOut.brand.trim() : null
    const specs = Array.isArray(parsedOut.specs)
      ? parsedOut.specs
          .filter((s): s is { label: string; value: string } =>
            !!s && typeof s === 'object'
            && typeof (s as Record<string, unknown>).label === 'string'
            && typeof (s as Record<string, unknown>).value === 'string')
          .map((s) => ({ label: s.label.trim().slice(0, 60), value: s.value.trim().slice(0, 200) }))
          .filter((s) => s.label && s.value)
          .slice(0, 30)
      : []

    return NextResponse.json({ brand, specs })
  } catch (err) {
    console.error('Product facts extraction error:', err)
    return NextResponse.json({ error: 'Extraction failed' }, { status: 502 })
  }
}
