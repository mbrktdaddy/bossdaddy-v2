import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCategoryLabel } from '@/lib/categories'
import { getProductBySlug, getProductsBySlugs } from '@/lib/products'
import { z } from 'zod'

// Web search can run several rounds + read sources, so this is the slowest
// Claude call in the stack. Generous ceiling; the manual button gates frequency.
export const maxDuration = 200

const SpecSchema = z.object({ label: z.string().max(60), value: z.string().max(200) })

const Input = z.object({
  productName:     z.string().min(2).max(120),
  brand:           z.string().max(120).optional(),
  category:        z.string().max(80),
  specs:           z.array(SpecSchema).max(40).default([]),
  // When given, the endpoint loads the product's brand + specs server-side (the
  // catalog is authoritative), so the client doesn't marshal them.
  productSlug:     z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  // Author-curated rivals to steer the search. competitorSlugs are resolved to
  // "Brand Name" hints server-side; competitorHints are free-text. The operator
  // is the domain expert, so their picks take priority over the AI's discovery.
  competitorSlugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(8).default([]),
  competitorHints: z.array(z.string().max(120)).max(8).default([]),
})

const SPECS_GRADE_SYSTEM = `You are an objective product-specs analyst for Boss Daddy, an affiliate review site. Your job: grade how a product's MEASURABLE specifications stack up against genuinely comparable models in the same category — using live web search to gather real, current competitor specs. You are judged on accuracy and honesty, not generosity.

WHAT THE GRADE MEANS (1-10) — this is ONLY about the spec sheet (measurable capabilities vs the competitive field). It is NOT about build quality you can't measure, price/value, or ease of use (a human scores those separately):
- 9-10: best-in-class specs for the category; leads on most key dimensions.
- 7-8: strong; above the median on the specs that matter.
- 5-6: middle of the pack; competitive but unremarkable.
- 3-4: behind the field on important specs.
- 1-2: well behind / outclassed.

PROCESS:
1. Identify 4-6 genuinely comparable models (same category, similar price tier / use case). Prefer the author's suggested competitors when given, then add the obvious rivals.
2. Use web search to find each competitor's KEY specs from reputable sources — prefer manufacturer pages and major retailers, then established review outlets.
3. Compare the subject product's specs (provided to you) against what you found, weighing the specs that actually matter for the category.
4. Assign the grade and write a concise, factual rationale (3-5 sentences) a buyer would find useful, referencing concrete deltas ("lighter than the X, but lower torque than the Y").

HARD RULES:
- Use ONLY specs you actually found via search or that were provided. NEVER invent, infer, or estimate a competitor's spec. If you couldn't verify it, leave it out.
- Every competitor you cite must include at least one real source URL you actually retrieved.
- If you cannot find enough reliable comparison data to grade fairly, ABSTAIN: set "grade": null and "abstained": true and explain why in "rationale". A null grade is correct and expected for obscure products — never force a number.
- Compare like with like (drills to drills, not the whole tool aisle).

OUTPUT: valid JSON only — no markdown, no code fences, no commentary — as your final message:
{
  "grade": <number 1-10 or null>,
  "abstained": <boolean>,
  "rationale": "<string>",
  "comparedAgainst": [ { "name": "<string>", "brand": "<string or null>", "keySpecs": [ { "label": "<string>", "value": "<string>" } ], "sourceUrl": "<string>" } ],
  "sources": [ { "title": "<string>", "url": "<string>" } ]
}`

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

export async function POST(request: NextRequest) {
  // Outer guard: auth, rate-limit (Redis), and the product/profile DB loads all
  // run before the Claude try/catch below. A throw there would otherwise escape
  // as a non-JSON platform error page ("An error occurred…") that crashes the
  // client's JSON parse. Catch everything and always answer with JSON.
  try {
    return await handlePost(request)
  } catch (err) {
    console.error('specs-grade handler error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Grading failed (server): ${msg.slice(0, 160)}` }, { status: 500 })
  }
}

async function handlePost(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Authoring tool — authors and admins only.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['author', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { success } = await checkRateLimit(`specs-grade:${user.id}`, 'specs-grade')
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded — specs grading is limited per hour.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { productName, brand, category, specs, productSlug, competitorSlugs, competitorHints } = parsed.data
  const categoryLabel = getCategoryLabel(category)

  // Catalog is authoritative — load the subject's brand + specs from the product
  // when linked; fall back to whatever the client passed.
  let effBrand = brand?.trim() || null
  let effSpecs = specs.filter((s) => s.label.trim() && s.value.trim())
  if (productSlug) {
    const p = await getProductBySlug(supabase, productSlug)
    if (p) {
      if (!effBrand && p.brand) effBrand = p.brand
      const ps = (Array.isArray(p.specs) ? p.specs : []).filter((s) => s?.label?.trim() && s?.value?.trim())
      if (ps.length) effSpecs = ps
    }
  }

  // Resolve curated competitor slugs to "Brand Name" hints, merge with free-text.
  const hints = [...competitorHints]
  if (competitorSlugs.length) {
    const comps = await getProductsBySlugs(supabase, competitorSlugs)
    for (const c of comps) hints.push(c.brand ? `${c.brand} ${c.name}` : c.name)
  }
  const dedupedHints = [...new Set(hints.map((h) => h.trim()).filter(Boolean))].slice(0, 8)

  const prompt = `Grade the specs of this product against comparable models in its category.

Product: ${effBrand ? `${effBrand} ` : ''}${productName}
Category: ${categoryLabel}${dedupedHints.length ? `\nAuthor-suggested competitors (prioritize these): ${dedupedHints.join(', ')}` : ''}

Subject product specs:
${effSpecs.length ? effSpecs.map((s) => `- ${s.label}: ${s.value}`).join('\n') : '(none provided — search for this product\'s own key specs too)'}

Find comparable models, gather their real specs via web search, then return the grading JSON.`

  // 6 searches comfortably covers 4-6 comparable models (≈1 each) while keeping
  // the run well under the 200s ceiling — 10 drove a fragile ~115s call.
  const tools = [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 6 }]
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: prompt }]
  // 8000 leaves room for the model's queries + a multi-model comparison matrix
  // so the final JSON isn't truncated. (max_tokens caps OUTPUT; the fetched
  // search results are server-injected and don't count against it.)
  const createArgs = (msgs: Anthropic.Messages.MessageParam[]) => ({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: 'text' as const, text: SPECS_GRADE_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    tools,
    messages: msgs,
  })

  let message: Anthropic.Messages.Message
  try {
    message = await getClaudeClient().messages.create(createArgs(messages))
    // The web_search tool can return stop_reason 'pause_turn' on long search
    // loops — continue the turn (passing the partial content back) until it
    // finishes, capped so a misbehaving loop can't run forever.
    let guard = 0
    while (message.stop_reason === 'pause_turn' && guard < 3) {
      guard++
      messages.push({ role: 'assistant', content: message.content })
      message = await getClaudeClient().messages.create(createArgs(messages))
    }
  } catch (err) {
    console.error('specs-grade Claude/web_search error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Grading failed: ${msg.slice(0, 160)}` }, { status: 502 })
  }

  // The final answer is the model's last text block (search happens via server
  // tool_use blocks in between). Join text blocks defensively, then take the
  // JSON object from the tail.
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // A truncated or still-paused response yields no closing JSON — give a hint.
    const hint = message.stop_reason === 'max_tokens'
      ? ' (the comparison ran long — try again)'
      : message.stop_reason === 'pause_turn'
      ? ' (the web search timed out — try again)'
      : ''
    return NextResponse.json({ error: `Model returned an unexpected format${hint}.` }, { status: 502 })
  }

  let out: Record<string, unknown>
  try {
    out = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({ error: 'Model returned malformed content — try again.' }, { status: 502 })
  }

  const abstained = out.abstained === true
  let grade: number | null = null
  if (!abstained && (typeof out.grade === 'number' || typeof out.grade === 'string')) {
    const n = Math.round(Number(out.grade))
    if (Number.isFinite(n) && n >= 1 && n <= 10) grade = n
  }

  const rationale = typeof out.rationale === 'string' ? out.rationale.trim().slice(0, 1500) : ''

  const comparedAgainst = Array.isArray(out.comparedAgainst)
    ? out.comparedAgainst
        .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
        .map((c) => ({
          name:  typeof c.name === 'string' ? c.name.trim().slice(0, 120) : '',
          brand: typeof c.brand === 'string' && c.brand.trim() ? c.brand.trim().slice(0, 120) : null,
          keySpecs: Array.isArray(c.keySpecs)
            ? c.keySpecs
                .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object'
                  && typeof s.label === 'string' && typeof s.value === 'string')
                .map((s) => ({ label: (s.label as string).trim().slice(0, 60), value: (s.value as string).trim().slice(0, 200) }))
                .filter((s) => s.label && s.value)
                .slice(0, 12)
            : [],
          sourceUrl: isHttpUrl(c.sourceUrl) ? (c.sourceUrl as string).trim() : null,
        }))
        .filter((c) => c.name)
        .slice(0, 8)
    : []

  const sources = Array.isArray(out.sources)
    ? out.sources
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && isHttpUrl(s.url))
        .map((s) => ({ title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 200) : (s.url as string), url: (s.url as string).trim() }))
        .slice(0, 12)
    : []

  return NextResponse.json({ grade, abstained, rationale, comparedAgainst, sources })
}
