import { NextResponse, type NextRequest } from 'next/server'
import { jsonSchema } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiGenerateObject } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
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

const PRODUCT_FACTS_SCHEMA = jsonSchema<{ brand: unknown; specs: unknown }>({
  type: 'object',
  properties: {
    brand: { type: ['string', 'null'] },
    specs: { type: 'array', items: {
      type: 'object',
      properties: { label: { type: 'string' }, value: { type: 'string' } },
      required: ['label', 'value'],
    } },
  },
  required: ['brand', 'specs'],
})

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
    const out = await aiGenerateObject<{ brand: unknown; specs: unknown }>({
      bucket: 'utility',
      tag: 'product-facts',
      system: PRODUCT_FACTS_SYSTEM,
      schema: PRODUCT_FACTS_SCHEMA,
      prompt,
      maxOutputTokens: 800,
    })

    const brand = typeof out.brand === 'string' && out.brand.trim() ? out.brand.trim() : null
    const specs = Array.isArray(out.specs)
      ? out.specs
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
    const c = classifyClaudeError(err)
    console.error('product-facts error:', c.kind, '-', c.detail)
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}
