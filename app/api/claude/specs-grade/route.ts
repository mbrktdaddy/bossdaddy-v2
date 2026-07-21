import { NextResponse, type NextRequest, after } from 'next/server'
import { jsonSchema, type JSONSchema7 } from 'ai'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { aiResearch } from '@/lib/ai/research'
import { classifyClaudeError } from '@/lib/ai/errors'
import { createJob, getJob, markRunning, markDone, markError } from '@/lib/aiJobs'
import { checkRateLimit } from '@/lib/rate-limit'
import { getCategoryLabel } from '@/lib/categories'
import { getProductBySlug, getProductsBySlugs } from '@/lib/products'
import { z } from 'zod'

// The grading work runs in the background via after(), NOT in the request the
// client waits on — the client gets a jobId immediately and polls GET. The
// function instance stays alive for the after() task up to maxDuration; web
// search can run several rounds, so keep the full headroom under the Pro cap.
export const maxDuration = 300

const SpecSchema = z.object({ label: z.string().max(60), value: z.string().max(200) })

const Input = z.object({
  productName:     z.string().min(2).max(120),
  brand:           z.string().max(120).optional(),
  category:        z.string().max(80),
  specs:           z.array(SpecSchema).max(40).default([]),
  // When given, the endpoint loads the product's brand + specs + price server-side
  // (the catalog is authoritative), so the client doesn't marshal them.
  productSlug:     z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
  // Author-curated rivals to steer the search. competitorSlugs are resolved to
  // their stored specs + price server-side; competitorHints are free-text. The
  // operator is the domain expert, so their picks take priority over discovery.
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
2. Use web search to find KEY specs from reputable sources. PRIORITIZE sources that compare several models at once — established review outlets (e.g. RTINGS, Wirecutter, and category-specific review sites), independent spec-comparison databases, and retailer spec tables — because one solid comparison or "X vs Y" article often yields verified specs for multiple rivals in a single search. Use manufacturer pages mainly for the subject product's own specs. When an independent reviewer's measured figure disagrees with the manufacturer's claim, prefer the measured figure and note the discrepancy.
3. Compare the subject product's specs (provided to you) against what you found, weighing the specs that actually matter for the category.
4. Assign the grade and write a concise, factual rationale (3-5 sentences) a buyer would find useful, referencing concrete deltas ("lighter than the X, but lower torque than the Y").

HARD RULES:
- Use ONLY specs you actually found via search or that were provided. NEVER invent, infer, or estimate a competitor's spec. If you couldn't verify it, leave it out.
- Every competitor you cite must include at least one real source URL you actually retrieved.
- If you cannot find enough reliable comparison data to grade fairly, ABSTAIN: set "grade": null and "abstained": true and explain why in "rationale". A null grade is correct and expected for obscure products — never force a number.
- BE EFFICIENT — lead with a comparison/review search that covers multiple rivals at once rather than one search per competitor. If a few targeted searches (including at least one comparison or review article) still don't surface reliable data — common for niche/small-brand products — ABSTAIN promptly. Do NOT exhaust your search budget chasing an obscure product; a fast, honest abstain beats a slow run that times out.
- Compare like with like (drills to drills, not the whole tool aisle).
- COMPARE WITHIN THE SAME PRICE TIER. Comparable models should sit in roughly the same price class as the subject — anchor on the curated competitors and the subject's price (a rough 0.5×–2× price band is a sensible default). Do NOT grade a budget product against a flagship, or vice-versa; a cross-tier comparison skews the grade. If in-band comparables are thin, widen the band modestly and SAY SO in the rationale (e.g. "limited direct comparables in this price class"), or grade against the closest available and note the caveat — abstain only if there's no comparable field at any reasonable band.

OUTPUT: When you have gathered enough comparison data (or have decided to abstain), return your result as the required structured object (grade, abstained, rationale, comparedAgainst, sources). To abstain, set grade=null and abstained=true and explain why in the rationale.`

// The grading is returned as one schema-validated object (AI SDK `Output.object`)
// after the model runs its web_search steps — no output tool, no prose salvage.
const GRADE_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {
      grade:     { type: ['number', 'null'], description: '1-10 specs grade, or null when abstaining' },
      abstained: { type: 'boolean' },
      rationale: { type: 'string', description: '3-5 factual sentences referencing concrete spec deltas' },
      comparedAgainst: { type: 'array', items: {
        type: 'object',
        properties: {
          name:  { type: 'string' },
          brand: { type: ['string', 'null'] },
          keySpecs: { type: 'array', items: {
            type: 'object',
            properties: { label: { type: 'string' }, value: { type: 'string' } },
            required: ['label', 'value'],
          } },
          sourceUrl: { type: ['string', 'null'], description: 'A real source URL you actually retrieved' },
        },
        required: ['name', 'keySpecs'],
      } },
      sources: { type: 'array', items: {
        type: 'object',
        properties: { title: { type: 'string' }, url: { type: 'string' } },
        required: ['url'],
      } },
    },
    required: ['grade', 'abstained', 'rationale', 'comparedAgainst', 'sources'],
}

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

function usd(cents: number | null | undefined): string | null {
  return cents != null && cents > 0 ? `$${Math.round(cents / 100)}` : null
}

// ── Background work ──────────────────────────────────────────────────────────
// Runs the Claude + web_search call, extracts the structured grade, normalizes
// it, and returns the payload. Throws on API error / unusable output — the
// caller maps that to the job's error field.
async function runSpecsGrade(prompt: string): Promise<Record<string, unknown>> {
  // Provider-native web search + one schema-validated object (no output tool, no
  // pause_turn loop, no prose salvage — the SDK guarantees `out` or throws). 6
  // searches comfortably covers 4-6 comparable models (≈1 each); maxSteps leaves
  // room for those search steps plus the final structured-output step.
  const { object: out } = await aiResearch<Record<string, unknown>>({
    tag: 'specs-grade',
    system: SPECS_GRADE_SYSTEM,
    prompt,
    schema: jsonSchema<Record<string, unknown>>(GRADE_SCHEMA),
    search: { maxUses: 6 },
    maxSteps: 9,
    maxOutputTokens: 8000,
    // Anthropic returns transient 529 overloaded_error under load — extra retry
    // headroom rides out a brief spike.
    maxRetries: 4,
  })

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

  return { grade, abstained, rationale, comparedAgainst, sources }
}

// ── POST = start the job ─────────────────────────────────────────────────────
// Resolves all catalog data, builds the prompt, creates a pending job, kicks off
// the grading in the background, and returns the jobId immediately.
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { user } = await getUserSafe(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    // Catalog is authoritative — load the subject's brand + specs + price.
    let effBrand = brand?.trim() || null
    let effSpecs = specs.filter((s) => s.label.trim() && s.value.trim())
    let effPrice: number | null = null
    if (productSlug) {
      const p = await getProductBySlug(supabase, productSlug)
      if (p) {
        if (!effBrand && p.brand) effBrand = p.brand
        const ps = (Array.isArray(p.specs) ? p.specs : []).filter((s) => s?.label?.trim() && s?.value?.trim())
        if (ps.length) effSpecs = ps
        effPrice = p.price_cents ?? null
      }
    }

    // Curated competitors: pull stored specs + price from the catalog so the
    // grader grounds on operator data first and uses prices as the tier anchor.
    const knownCompetitors: { head: string; price: number | null; specs: { label: string; value: string }[] }[] = []
    if (competitorSlugs.length) {
      const comps = await getProductsBySlugs(supabase, competitorSlugs)
      for (const c of comps) {
        const cs = (Array.isArray(c.specs) ? c.specs : []).filter((s) => s?.label?.trim() && s?.value?.trim())
        knownCompetitors.push({ head: c.brand ? `${c.brand} ${c.name}` : c.name, price: c.price_cents ?? null, specs: cs })
      }
    }
    const nameHints = [...new Set([
      ...competitorHints.map((h) => h.trim()).filter(Boolean),
      ...knownCompetitors.map((c) => c.head),
    ].filter(Boolean))].slice(0, 8)

    const knownCompetitorsBlock = knownCompetitors.some((c) => c.specs.length)
      ? `\n\nKnown competitor specs (operator-curated, verified — use these directly; web-search only to fill missing fields or add rivals beyond this set; never contradict these):\n${knownCompetitors.map((c) => {
          const priceTag = usd(c.price) ? ` (~${usd(c.price)})` : ''
          const lines = c.specs.length
            ? c.specs.map((s) => `    • ${s.label}: ${s.value}`).join('\n')
            : '    • (no specs on file — search for these)'
          return `- ${c.head}${priceTag}:\n${lines}`
        }).join('\n')}`
      : ''

    // Price-tier anchor: prefer the subject's price; otherwise lean on the
    // curated competitors' price range so the model still has a tier signal.
    const compPrices = knownCompetitors.map((c) => c.price).filter((n): n is number => n != null && n > 0)
    const tierLine = usd(effPrice)
      ? `\nPrice tier anchor: the subject costs about ${usd(effPrice)} — only compare against models in a similar price class.`
      : compPrices.length
      ? `\nPrice tier anchor: the curated competitors run ${usd(Math.min(...compPrices))}–${usd(Math.max(...compPrices))} — treat that as the price class to stay within.`
      : ''

    const prompt = `Grade the specs of this product against comparable models in its category.

Product: ${effBrand ? `${effBrand} ` : ''}${productName}${usd(effPrice) ? ` (~${usd(effPrice)})` : ''}
Category: ${categoryLabel}${nameHints.length ? `\nAuthor-suggested competitors (prioritize these): ${nameHints.join(', ')}` : ''}${tierLine}

Subject product specs (verified — treat as the subject's facts):
${effSpecs.length ? effSpecs.map((s) => `- ${s.label}: ${s.value}`).join('\n') : '(none on file — search for this product\'s own key specs too)'}${knownCompetitorsBlock}

Use the verified specs above as ground truth, and stay within the subject's price class. Web-search to fill gaps, to verify, and to add comparable in-tier models, then return the grading.`

    const jobId = await createJob(user.id, 'specs_grade', { prompt })

    // Run the long grading AFTER the response is sent. Vercel keeps the function
    // instance alive for after() work (up to maxDuration); the client polls GET.
    after(async () => {
      try {
        await markRunning(jobId)
        const result = await runSpecsGrade(prompt)
        await markDone(jobId, result)
      } catch (err) {
        const c = classifyClaudeError(err)
        console.error('specs-grade job failed:', c.kind, c.detail)
        await markError(jobId, c.userMessage)
      }
    })

    return NextResponse.json({ jobId }, { status: 202 })
  } catch (err) {
    console.error('specs-grade start error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Could not start grading: ${msg.slice(0, 160)}` }, { status: 500 })
  }
}

// ── GET = poll the job ───────────────────────────────────────────────────────
export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobId = request.nextUrl.searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 })

  const job = await getJob(jobId, user.id)
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  return NextResponse.json({ status: job.status, result: job.result, error: job.error })
}
