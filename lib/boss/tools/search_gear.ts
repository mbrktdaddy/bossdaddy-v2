import { embedQuery } from '@/lib/ai/embedding'
import type { Block, BossTool } from '../types'

const GEAR_LIMIT = 8
// Cosine-similarity floor for the semantic side of the hybrid search — the cut
// that kills the junk-card bug. Chosen from the measured distribution
// (`npm run hybrid:smoke`): real matches clear it comfortably (swing sets 0.46-0.47,
// baby carrier 0.36, pellet smoker 0.41) while adjacent-but-wrong items fall below
// (kids water table 0.25, cook stove 0.23, a gas grill for a "smoker" query 0.30),
// and absent categories (no stroller/drill reviewed, top match ~0.25-0.27) correctly
// return nothing → honest "no tested pick" + the research fallback.
const MIN_SIMILARITY = 0.35

const COLS =
  'slug, title, product_name, product_slug, rating, score_quality, score_value, score_ease, score_daily_use, score_specs, excerpt, is_top_pick'

type Row = {
  slug: string
  title: string
  product_name: string | null
  product_slug: string | null
  rating: number | null
  score_quality: number | null
  score_value: number | null
  score_ease: number | null
  score_daily_use: number | null
  score_specs: number | null
  excerpt: string | null
  is_top_pick: boolean | null
}

// A — Decide & Buy. Grounded retrieval over the founder's own hands-on, approved
// reviews via HYBRID search (migration 125): Postgres full-text for exact-keyword
// precision + pgvector cosine similarity for meaning/recall, fused with RRF and
// floored by similarity so off-topic rows never surface. The model RANKS the
// returned candidates and writes the third-person verdict; it must never
// recommend a product not present in `candidates`. Empty candidates = honest "no
// tested pick yet" (the `note` instructs this).
export const searchGear: BossTool = {
  definition: {
    name: 'search_gear',
    description:
      "Search Boss Daddy's own hands-on, approved gear reviews. Use for ANY product recommendation, comparison, or 'what should I buy' question. Returns only real, tested, published reviews with sub-scores and buy links. Recommend ONLY from the returned candidates — if it returns none, there is no tested pick yet, so say that honestly and never invent one.",
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords for the product need, e.g. "lightweight twin stroller" or "cordless drill for a tall guy".',
        },
        price_min_cents: { type: 'integer', description: 'Optional minimum price in cents.' },
        price_max_cents: { type: 'integer', description: 'Optional maximum price in cents.' },
        limit: { type: 'integer', maximum: GEAR_LIMIT, description: 'Max results (<= 8).' },
      },
      required: ['query'],
    },
  },
  async handler(input, ctx) {
    const query = String(input.query ?? '').trim()
    const limit = Math.min(Number(input.limit) || GEAR_LIMIT, GEAR_LIMIT)
    if (!query) return { content: JSON.stringify({ candidates: [], note: 'No query provided.' }) }

    const min = typeof input.price_min_cents === 'number' ? input.price_min_cents : null
    const max = typeof input.price_max_cents === 'number' ? input.price_max_cents : null

    let rows: Row[] = []
    try {
      // Primary path: hybrid semantic + full-text. Price bounds are applied inside
      // the RPC (against the linked product). pgvector wants the vector as a string.
      const embedding = await embedQuery(query)
      const { data, error } = await ctx.supabase
        .rpc('boss_hybrid_reviews', {
          query_text: query,
          query_embedding: JSON.stringify(embedding),
          match_count: limit,
          min_similarity: MIN_SIMILARITY,
          ...(min != null ? { price_min_cents: min } : {}),
          ...(max != null ? { price_max_cents: max } : {}),
        })
        .select(COLS)
      if (error) throw error
      rows = (data ?? []) as Row[]
    } catch {
      // Degraded mode (embedding/gateway hiccup only): STRICT full-text, precise
      // by design. The old OR-of-terms fallback is intentionally gone — semantic
      // recall replaced it, so the fallback stays clean rather than reintroducing
      // the junk-match behavior.
      const { data } = await ctx.supabase
        .from('reviews')
        .select(COLS)
        .eq('status', 'approved')
        .eq('is_visible', true)
        .order('rating', { ascending: false, nullsFirst: false })
        .order('is_top_pick', { ascending: false })
        .limit(limit)
        .textSearch('search_vector', query, { type: 'websearch' })
      rows = (data ?? []) as Row[]

      // Price bounds aren't in the fallback query (reviews carry no price) — apply
      // them from the linked products, mirroring the RPC's filter.
      if ((min != null || max != null) && rows.length) {
        const slugs = rows.map((r) => r.product_slug).filter((s): s is string => !!s)
        if (!slugs.length) {
          rows = []
        } else {
          const { data: products } = await ctx.supabase.from('products').select('slug, price_cents').in('slug', slugs)
          const priceBySlug = new Map((products ?? []).map((p) => [p.slug, p.price_cents]))
          rows = rows.filter((r) => {
            if (!r.product_slug) return false
            const price = priceBySlug.get(r.product_slug)
            if (price == null) return false
            if (min != null && price < min) return false
            if (max != null && price > max) return false
            return true
          })
        }
      }
    }

    const citations: Block[] = rows.map((r) => ({
      kind: 'review',
      slug: r.slug,
      title: r.title,
      url: `/reviews/${r.slug}`,
      buyUrl: r.product_slug ? `/go/${r.product_slug}` : null,
      rating: r.rating,
      scores: { quality: r.score_quality, value: r.score_value, ease: r.score_ease, dailyUse: r.score_daily_use },
      specsGrade: r.score_specs,
    }))

    const candidates = rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      productName: r.product_name,
      rating: r.rating,
      scores: { quality: r.score_quality, value: r.score_value, ease: r.score_ease, dailyUse: r.score_daily_use },
      specsGrade: r.score_specs,
      excerpt: r.excerpt,
      reviewUrl: `/reviews/${r.slug}`,
      buyUrl: r.product_slug ? `/go/${r.product_slug}` : null,
      isTopPick: r.is_top_pick,
    }))

    return {
      content: JSON.stringify({
        candidates,
        note: candidates.length
          ? null
          : 'No approved tested pick matches. Tell the user honestly there is no tested pick for that yet — do NOT invent a product.',
      }),
      citations,
    }
  },
}
