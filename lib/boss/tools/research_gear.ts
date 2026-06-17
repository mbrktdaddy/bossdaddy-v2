import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient, MODEL } from '@/lib/claude/client'
import { extractToolInput } from '@/lib/claude/structured'
import { createAdminClient } from '@/lib/supabase/admin'
import { appendAmazonTag, buildAmazonAffiliateUrl, extractAsin } from '@/lib/amazon-tag'
import { checkRateLimit } from '@/lib/rate-limit'
import { CATEGORY_SLUGS } from '@/lib/categories'
import type { BossTool, Citation } from '../types'

// A (gap fallback) — Decide & Buy when there is NO tested pick. This is the
// second-class lane: search_gear (hands-on, tested) is always tried first; only
// when it returns nothing does The Boss escalate here. The output is EXPLICITLY
// "researched, not tested" — no Boss rating, sources always shown. We reuse the
// Specs-Grade methodology (Anthropic native web_search + cited sources +
// abstain) so this is our research, not generic ChatGPT-with-Amazon-links.
//
// Cost control: web_search is the priciest call in the stack. This tool is
// member-gated (minTier 'free') and carries its own tight per-user rate key on
// top of the turn limit; the search is hard-capped and instructed to abstain
// promptly on niche queries (it 504'd on specs-grade before that guardrail).

const MAX_PICKS = 5
const WEB_SEARCH_MAX_USES = 4

const RESEARCH_SYSTEM = `You research consumer gear for "Boss Daddy", an affiliate site for dads. The founder has NOT field-tested the item the user is asking about, so you build a SHORTLIST FROM RESEARCH ONLY — clearly second-class to his hands-on reviews. You are judged on honesty and real sourcing, never generosity.

YOUR JOB: find 3-5 genuinely available, current products that fit the user's stated need, using live web search of reputable sources, and return them via the submit_research tool.

PROCESS:
1. Read the need carefully (age of kid, twins, tall dad, budget, use case). Pick options that actually fit it.
2. Web-search reputable sources — established review outlets (Wirecutter, BabyGearLab, RTINGS, category review sites), spec databases, and retailer pages. Prefer "best X" roundups and head-to-head comparisons: one good roundup yields several vetted options in a single search. BE EFFICIENT — a few targeted searches, not one per product.
3. For each pick, capture: real product name, brand, a price tier (budget / mid / premium), a human price hint ("$180–220"), one line on why it fits THIS need, a short research-consensus note, and at least one REAL source URL you actually retrieved. Include a real Amazon product URL when you find one.
4. Span price tiers when natural (a budget, a mid, a premium) so the dad can pick his level.

HARD RULES:
- NEVER invent a product, price, spec, or source. Every pick needs at least one real https source URL you actually retrieved. Drop any pick you can't source.
- These are NOT tested by the Boss. Do not write verdicts or ratings — just what the research says.
- If you cannot find enough credible options for this specific need, ABSTAIN: call submit_research with abstained=true, picks=[], and one line why. A fast honest abstain beats a slow run that times out — do NOT burn the search budget chasing an obscure query.
- Compare like with like and stay near the user's budget if they gave one.

OUTPUT: When done (or abstaining), you MUST return the result by calling the submit_research tool. Do not answer in plain prose.`

const RESEARCH_TOOL: Anthropic.Tool = {
  name: 'submit_research',
  description: 'Return the researched (NOT tested) shortlist after gathering web data, or abstain.',
  input_schema: {
    type: 'object',
    properties: {
      abstained: { type: 'boolean' },
      note: { type: ['string', 'null'], description: 'If abstaining, one short line why.' },
      picks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Real product name' },
            brand: { type: ['string', 'null'] },
            priceTier: { type: ['string', 'null'], description: 'budget | mid | premium' },
            priceText: { type: ['string', 'null'], description: 'Short price RANGE only, e.g. "$180–220". No MSRP/sale commentary, no sentences — just the range.' },
            fit: { type: 'string', description: 'One line: why it fits the stated need' },
            why: { type: ['string', 'null'], description: 'Short research-consensus note' },
            amazonUrl: { type: ['string', 'null'], description: 'Real Amazon product URL if found' },
            sources: {
              type: 'array',
              items: {
                type: 'object',
                properties: { title: { type: 'string' }, url: { type: 'string' } },
                required: ['url'],
              },
            },
          },
          required: ['name', 'fit', 'sources'],
        },
      },
    },
    required: ['abstained', 'picks'],
  },
}

type RawPick = {
  name: string
  brand: string | null
  priceTier: 'budget' | 'mid' | 'premium' | null
  priceText: string | null
  fit: string
  why: string | null
  amazonUrl: string | null
  sources: { title: string; url: string }[]
}

const PRICE_TIERS = new Set(['budget', 'mid', 'premium'])

function isHttpUrl(s: unknown): s is string {
  return typeof s === 'string' && /^https?:\/\//i.test(s.trim())
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

// Models often repeat the brand in the product name ("Samsung" + "Samsung
// Galaxy Buds4 Pro"). Only prepend the brand when the name doesn't already lead
// with it, so the display title reads clean.
function displayName(brand: string | null, name: string): string {
  if (!brand) return name
  return name.toLowerCase().startsWith(brand.toLowerCase()) ? name : `${brand} ${name}`
}

// Normalize the model's submit_research payload into clean, sourced picks.
function normalizePicks(out: Record<string, unknown>): RawPick[] {
  if (!Array.isArray(out.picks)) return []
  return out.picks
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => {
      const sources = Array.isArray(p.sources)
        ? p.sources
            .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && isHttpUrl(s.url))
            .map((s) => ({
              title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 160) : (s.url as string),
              url: (s.url as string).trim(),
            }))
            .slice(0, 4)
        : []
      const tierRaw = typeof p.priceTier === 'string' ? p.priceTier.trim().toLowerCase() : ''
      return {
        name: typeof p.name === 'string' ? p.name.trim().slice(0, 120) : '',
        brand: typeof p.brand === 'string' && p.brand.trim() ? p.brand.trim().slice(0, 80) : null,
        priceTier: PRICE_TIERS.has(tierRaw) ? (tierRaw as RawPick['priceTier']) : null,
        priceText: typeof p.priceText === 'string' && p.priceText.trim() ? p.priceText.trim().slice(0, 48) : null,
        fit: typeof p.fit === 'string' ? p.fit.trim().slice(0, 200) : '',
        why: typeof p.why === 'string' && p.why.trim() ? p.why.trim().slice(0, 300) : null,
        amazonUrl: isHttpUrl(p.amazonUrl) ? (p.amazonUrl as string).trim() : null,
        sources,
      }
    })
    .filter((p) => p.name && p.fit && p.sources.length) // every pick must be sourced
    .slice(0, MAX_PICKS)
}

// Build the tracked affiliate URL for a researched pick. Prefer a real ASIN ->
// canonical affiliate URL; otherwise a tagged Amazon search by name. Returns null
// if we have no associate tag configured (so /go has nothing to redirect to).
function affiliateUrlFor(pick: RawPick): string | null {
  const tag = process.env.AMAZON_ASSOCIATE_TAG
  if (!tag) return null
  if (pick.amazonUrl) {
    const asin = extractAsin(pick.amazonUrl)
    if (asin) return buildAmazonAffiliateUrl(asin, tag)
    const tagged = appendAmazonTag(pick.amazonUrl, tag)
    if (tagged && /amazon\./i.test(tagged)) return tagged
  }
  const q = encodeURIComponent([pick.brand, pick.name].filter(Boolean).join(' '))
  return appendAmazonTag(`https://www.amazon.com/s?k=${q}`, tag)
}

// Auto-seed the catalog so a gap query feeds the product spine + bench loop:
// each pick becomes a `researched` products row (with a tracked /go link) and a
// Bench entry. Both are insert-if-new — we NEVER downgrade an existing real
// product (e.g. one already 'reviewed') back to 'researched'. Best-effort:
// failures here must never break the chat answer. Uses the admin client because
// products/wishlist writes are is_admin()-gated.
async function seedCatalog(
  picks: RawPick[],
): Promise<Map<string, { slug: string; buyUrl: string | null }>> {
  const bySlug = new Map<string, { slug: string; buyUrl: string | null }>()
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return bySlug
  }

  for (const pick of picks) {
    const base = slugify([pick.brand, pick.name].filter(Boolean).join(' '))
    if (!base || bySlug.has(pick.name)) continue
    const affiliate = affiliateUrlFor(pick)
    try {
      // Insert the product only if the slug is new; on conflict do nothing so we
      // never clobber a real catalog row. ignoreDuplicates returns [] on conflict.
      await admin
        .from('products')
        .upsert(
          {
            slug: base,
            name: pick.name,
            brand: pick.brand,
            status: 'researched',
            affiliate_url: affiliate,
            store: 'amazon',
          },
          { onConflict: 'slug', ignoreDuplicates: true },
        )

      // Bench entry (wishlist_items.slug is unique) — same insert-if-new rule.
      await admin
        .from('wishlist_items')
        .upsert(
          {
            slug: base,
            title: pick.name,
            affiliate_url: affiliate,
            store: 'amazon',
            status: 'considering',
          },
          { onConflict: 'slug', ignoreDuplicates: true },
        )

      bySlug.set(pick.name, { slug: base, buyUrl: affiliate ? `/go/${base}` : null })
    } catch {
      // Seed failure is non-fatal — the pick still renders, just without a /go
      // link if we couldn't persist it.
      bySlug.set(pick.name, { slug: base, buyUrl: null })
    }
  }
  return bySlug
}

// Log the gap query for the "most-requested untested" roadmap (admin-only).
async function logRoadmap(input: {
  userId: string | null
  query: string
  category: string | null
  fit: string | null
  resultsCount: number
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('boss_research_requests').insert({
      user_id: input.userId,
      query: input.query.slice(0, 500),
      category: input.category,
      fit: input.fit?.slice(0, 500) ?? null,
      results_count: input.resultsCount,
    })
  } catch {
    /* roadmap logging is best-effort */
  }
}

// The note appended to the tool result so the model narrates a cache hit and a
// fresh run identically — "researched, not tested," no Boss rating, then capture.
const RESEARCH_NOTE =
  "RESEARCHED, NOT TESTED. The user already sees a labeled list of each pick (name, price, fit, sources) below your message, plus a built-in 'notify me' + 'vote onto the bench' control. So: DON'T re-list or describe the picks (the list shows them), DON'T restate that they're untested (the list is labeled and you already said it on the way in), and DON'T add a bench/notify offer (the UI has it). Reply with just ONE short, casual lead — e.g. 'Here's the current lineup:' — optionally with a quick 'best overall: X, best value: Y' steer naming at most two. One or two sentences, no paragraphs, never a Boss rating."

const FRESH_DAYS = 30

// Filler words stripped when building the cache key, so phrasing doesn't matter.
const STOP = new Set([
  'a', 'an', 'the', 'best', 'top', 'good', 'great', 'what', 'whats', 'which', 'is', 'are', 'for', 'me', 'my', 'to', 'of',
  'and', 'or', 'vs', 'should', 'i', 'buy', 'get', 'need', 'want', 'recommend', 'recommendation', 'any', 'some', 'find',
  'looking', 'look', 'that', 'this', 'with', 'do', 'you', 'your', 'have', 'has', 'can', 'please', 'help', 'there',
])

// Constraint words that MATERIALLY change the result set — if one query has it
// and the other doesn't, they are NOT the same question (budget, count, use
// case, age). Any numeric token ("300", "1") is also a constraint. These force a
// fresh run, so a "twins jogging stroller" never serves a plain "stroller" cache.
const CONSTRAINT_WORDS = new Set([
  'twin', 'twins', 'double', 'triple', 'jogging', 'running', 'travel', 'foldable', 'folding', 'compact',
  'lightweight', 'waterproof', 'offroad', 'infant', 'newborn', 'toddler', 'convertible', 'umbrella', 'cheap', 'budget',
])
function isConstraintToken(t: string): boolean {
  return /\d/.test(t) || CONSTRAINT_WORDS.has(t)
}

// The significant tokens of a need: lowercase, drop punctuation + filler words,
// dedupe. "what are the best samsung earbuds" → ["samsung","earbuds"]. Order
// doesn't matter (we compare as sets); the sorted join is the exact-match key.
function significantTokens(q: string): string[] {
  return [
    ...new Set(
      q
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP.has(t)),
    ),
  ]
}
function queryKey(tokens: string[]): string {
  return [...tokens].sort().join(' ')
}

type CachedPayload = { candidates: unknown[]; citations: Citation[] }

function extractPayload(raw: unknown): CachedPayload | null {
  const p = raw as { candidates?: unknown[]; citations?: Citation[] } | null | undefined
  if (!p || !Array.isArray(p.citations) || !p.citations.length) return null
  return { candidates: Array.isArray(p.candidates) ? p.candidates : [], citations: p.citations }
}

// Fast-path: a fresh prior research run for the same (or near-identical) need.
// Avoids the web_search entirely (and the quota). Finds candidates sharing any
// significant token (GIN `&&`), then accepts the closest one only when it's an
// EXACT token-set match or differs by a single NON-constraint word (so "samsung
// earbuds" can serve "samsung galaxy earbuds", but never a budget/twins variant).
// Server-only via the admin client (admin-RLS). Null on miss / stale / any error.
async function readCache(tokens: string[]): Promise<CachedPayload | null> {
  if (!tokens.length) return null
  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - FRESH_DAYS * 86_400_000).toISOString()
    const { data } = await admin
      .from('boss_research_cache')
      .select('query_key, tokens, payload, hits')
      .overlaps('tokens', tokens)
      .gte('refreshed_at', cutoff)
      .order('refreshed_at', { ascending: false })
      .limit(20)

    const newSet = new Set(tokens)
    let best: { key: string; hits: number; payload: CachedPayload } | null = null
    let bestDiff = Infinity
    for (const row of data ?? []) {
      const rt: string[] = Array.isArray(row.tokens) ? (row.tokens as string[]) : []
      if (!rt.length) continue
      const rset = new Set(rt)
      const differing = [...tokens.filter((t) => !rset.has(t)), ...rt.filter((t) => !newSet.has(t))]
      const diff = differing.length
      if (diff > 1) continue // at most a single-word gap
      if (diff === 1 && isConstraintToken(differing[0])) continue // never bridge a constraint
      if (diff >= bestDiff) continue
      const payload = extractPayload(row.payload)
      if (!payload) continue
      best = { key: row.query_key, hits: row.hits ?? 0, payload }
      bestDiff = diff
      if (diff === 0) break // exact — can't do better
    }
    if (!best) return null
    await admin.from('boss_research_cache').update({ hits: best.hits + 1 }).eq('query_key', best.key)
    return best.payload
  } catch {
    return null
  }
}

async function writeCache(
  key: string,
  tokens: string[],
  category: string | null,
  payload: CachedPayload,
): Promise<void> {
  if (!key) return
  try {
    const admin = createAdminClient()
    await admin.from('boss_research_cache').upsert(
      { query_key: key, tokens, category, payload: payload as unknown as never, refreshed_at: new Date().toISOString() },
      { onConflict: 'query_key' },
    )
  } catch {
    /* cache write is best-effort */
  }
}

export const researchGear: BossTool = {
  // Members only: web_search is the priciest call, so visitors don't get to
  // trigger it (they hit the free-taste signup wall first).
  minTier: 'free',
  definition: {
    name: 'research_gear',
    description:
      "Call this proactively whenever search_gear returns no tested pick but the user is asking what to buy / what's best — don't ask permission first, just research it. Returns a clearly-labeled, NOT-tested shortlist with sources via live web search. These are NEVER presented as Boss-tested and carry no Boss rating — they're 'here's what the research turns up' while we get one on the bench. Offer the bench-vote / notify-me follow-up afterward.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The product need in the user\'s words, e.g. "lightweight stroller for a 1-year-old under $300".',
        },
        category: { type: 'string', enum: [...CATEGORY_SLUGS], description: 'Optional category for the roadmap log.' },
        fit: {
          type: 'string',
          description: 'Key constraints to honor: kid age, twins, budget, tall dad, use case. Helps fit + the roadmap.',
        },
      },
      required: ['query'],
    },
  },
  async handler(input, ctx) {
    const query = String(input.query ?? '').trim()
    const category = typeof input.category === 'string' && input.category ? input.category : null
    const fit = typeof input.fit === 'string' && input.fit.trim() ? input.fit.trim() : null
    if (!query) return { content: JSON.stringify({ picks: [], note: 'No query provided.' }) }

    // ── Fast-path: serve a fresh prior run instantly (no web_search, no quota). ──
    const tokens = significantTokens(query)
    const key = queryKey(tokens)
    const cached = await readCache(tokens)
    if (cached) {
      await logRoadmap({ userId: ctx.userId, query, category, fit, resultsCount: cached.citations.length })
      return { content: JSON.stringify({ picks: cached.candidates, note: RESEARCH_NOTE }), citations: cached.citations }
    }

    // Dedicated tighter quota on top of the per-turn boss limit — web_search cost.
    if (ctx.userId) {
      const { success } = await checkRateLimit(`boss-research:${ctx.userId}`, 'boss-research')
      if (!success) {
        return {
          content: JSON.stringify({
            picks: [],
            note: "The research desk is maxed for now (it does live web searches, which are limited). Tell the user honestly and offer to add it to the bench so the Boss tests one, or to come back a bit later.",
          }),
        }
      }
    }

    // ── The web-search research call (own messages.create, like specs-grade). ──
    const tools: Anthropic.Messages.MessageCreateParams['tools'] = [
      { type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES },
      RESEARCH_TOOL,
    ]
    const prompt = `Need: ${query}${fit ? `\nConstraints: ${fit}` : ''}${category ? `\nCategory: ${category}` : ''}

Research 3-5 currently-available products that fit this, spanning price tiers, and return them via submit_research. Abstain promptly if you can't credibly source options for this specific need.`
    const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: prompt }]
    const createArgs = (msgs: Anthropic.Messages.MessageParam[]) => ({
      model: MODEL,
      max_tokens: 4000,
      system: [{ type: 'text' as const, text: RESEARCH_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
      tools,
      messages: msgs,
    })
    const reqOpts = { maxRetries: 3 }

    let out: Record<string, unknown> | null = null
    try {
      let message = await getClaudeClient().messages.create(createArgs(messages), reqOpts)
      let guard = 0
      while (message.stop_reason === 'pause_turn' && guard < 3) {
        guard++
        messages.push({ role: 'assistant', content: message.content })
        message = await getClaudeClient().messages.create(createArgs(messages), reqOpts)
      }
      out = extractToolInput(message, 'submit_research')
      if (!out) {
        const text = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (jsonMatch) { try { out = JSON.parse(jsonMatch[0]) } catch { out = null } }
      }
    } catch {
      return {
        content: JSON.stringify({
          picks: [],
          note: "The research desk hit a snag (live web search). Tell the user honestly and offer to bench it for testing or try again shortly.",
        }),
      }
    }

    const abstained = !out || out.abstained === true
    const picks = out ? normalizePicks(out) : []

    if (abstained || !picks.length) {
      await logRoadmap({ userId: ctx.userId, query, category, fit, resultsCount: 0 })
      const why = out && typeof out.note === 'string' && out.note.trim() ? ` (${out.note.trim().slice(0, 160)})` : ''
      return {
        content: JSON.stringify({
          picks: [],
          note: `No credible researched options surfaced${why}. Tell the user honestly there's nothing solid to recommend yet, and offer to add it to the bench so the Boss tests one + notify them.`,
        }),
      }
    }

    // Seed the catalog + bench (best-effort) and log demand.
    const seeded = await seedCatalog(picks)
    await logRoadmap({ userId: ctx.userId, query, category, fit, resultsCount: picks.length })

    const citations: Citation[] = picks.map((p) => {
      const seed = seeded.get(p.name)
      const slug = seed?.slug ?? slugify([p.brand, p.name].filter(Boolean).join(' '))
      const buyUrl = seed?.buyUrl ?? null
      return {
        kind: 'product',
        slug,
        title: displayName(p.brand, p.name),
        url: buyUrl ?? p.sources[0]?.url ?? '#',
        buyUrl,
        researched: true,
        rating: null,
        priceTier: p.priceTier,
        priceText: p.priceText,
        fit: p.fit,
        sources: p.sources,
      }
    })

    // Compact candidates for the model to narrate (third person, NOT tested).
    const candidates = picks.map((p) => ({
      name: displayName(p.brand, p.name),
      priceTier: p.priceTier,
      priceText: p.priceText,
      fit: p.fit,
      why: p.why,
    }))

    // Cache this run so the next identical (or near-identical) gap query is instant + free.
    await writeCache(key, tokens, category, { candidates, citations })

    return {
      content: JSON.stringify({ picks: candidates, note: RESEARCH_NOTE }),
      citations,
    }
  },
}
