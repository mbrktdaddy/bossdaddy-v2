import { orTsQuery } from '../searchQuery'
import type { Block, BossTool } from '../types'

const GEAR_LIMIT = 8

// A — Decide & Buy. Grounded retrieval over the founder's own hands-on, approved
// reviews. The model RANKS the candidates and writes the third-person verdict; it
// must never recommend a product not present in `candidates`. Empty candidates =
// honest "no tested pick yet" (the `note` instructs this).
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

    // Strict full-text first (precise); broaden to an OR-of-terms fallback only
    // when strict finds nothing, so natural phrasing ("cordless drill for a tall
    // guy") still surfaces a tested pick instead of a false "no pick yet". NO
    // category filter — a review's category must never hide the best-RATED match
    // from a differently-categorized query (a swing set filed under outdoors was
    // hidden from a kids-family guess). Rating order lets the Boss's score decide.
    const base = () =>
      ctx.supabase
        .from('reviews')
        .select(
          'slug, title, product_name, product_slug, rating, score_quality, score_value, score_ease, score_daily_use, score_specs, excerpt, is_top_pick',
        )
        .eq('status', 'approved')
        .eq('is_visible', true)
        .order('rating', { ascending: false, nullsFirst: false })
        .order('is_top_pick', { ascending: false })
        .limit(limit)

    const strict = await base().textSearch('search_vector', query, { type: 'websearch' })
    if (strict.error) throw strict.error
    let rows = strict.data ?? []
    if (!rows.length) {
      const orQuery = orTsQuery(query)
      if (orQuery) {
        const relaxed = await base().textSearch('search_vector', orQuery)
        if (relaxed.error) throw relaxed.error
        rows = relaxed.data ?? []
      }
    }

    // Reviews don't carry price — pull it from the linked products when bounded.
    const min = typeof input.price_min_cents === 'number' ? input.price_min_cents : null
    const max = typeof input.price_max_cents === 'number' ? input.price_max_cents : null
    if ((min != null || max != null) && rows.length) {
      const slugs = rows.map((r) => r.product_slug).filter((s): s is string => !!s)
      if (!slugs.length) {
        rows = []
      } else {
        const { data: products } = await ctx.supabase
          .from('products')
          .select('slug, price_cents')
          .in('slug', slugs)
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
