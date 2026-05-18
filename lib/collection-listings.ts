import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shape returned by the listing helpers — minimal card-level fields plus
 * the dominant_category we compute from the items' underlying reviews.
 * Collections don't have a category column themselves (intentional — the
 * "category" of a comparison is derived from what's IN it), so we compute
 * it once per listing fetch via a second join.
 */
export interface ListingCollection {
  id:                string
  slug:              string
  title:             string
  description:       string | null
  hero_image_url:    string | null
  published_at:      string | null
  dominant_category: string | null
}

/**
 * Fetch visible collections of one or more types with their dominant
 * derived category computed. Two queries (collections + items+reviews),
 * not N+1.
 */
export async function getCollectionsWithCategory(
  supabase:        SupabaseClient,
  collectionTypes: string[],
): Promise<ListingCollection[]> {
  const { data: collsRaw } = await supabase
    .from('collections')
    .select('id, slug, title, description, hero_image_url, published_at, collection_type')
    .eq('is_visible', true)
    .in('collection_type', collectionTypes)
    .order('published_at', { ascending: false, nullsFirst: false })

  const colls = (collsRaw ?? []) as Array<{
    id: string; slug: string; title: string; description: string | null
    hero_image_url: string | null; published_at: string | null; collection_type: string
  }>

  if (colls.length === 0) return []

  // Second query: join collection_items → reviews to grab each item's
  // category. We then mode() it per collection in JS.
  const { data: itemsRaw } = await supabase
    .from('collection_items')
    .select('collection_id, reviews(category)')
    .in('collection_id', colls.map((c) => c.id))

  type ItemRow = { collection_id: string; reviews: { category: string | null } | { category: string | null }[] | null }
  const items = (itemsRaw ?? []) as ItemRow[]

  const categoriesByCollection = new Map<string, Map<string, number>>()
  for (const it of items) {
    const r = it.reviews
    const review = Array.isArray(r) ? r[0] : r
    const cat = review?.category ?? null
    if (!cat) continue
    let counts = categoriesByCollection.get(it.collection_id)
    if (!counts) { counts = new Map(); categoriesByCollection.set(it.collection_id, counts) }
    counts.set(cat, (counts.get(cat) ?? 0) + 1)
  }

  function pickDominant(id: string): string | null {
    const counts = categoriesByCollection.get(id)
    if (!counts) return null
    let best: string | null = null
    let bestCount = 0
    for (const [cat, n] of counts) {
      if (n > bestCount) { best = cat; bestCount = n }
    }
    return best
  }

  return colls.map((c) => ({
    id:                c.id,
    slug:              c.slug,
    title:             c.title,
    description:       c.description,
    hero_image_url:    c.hero_image_url,
    published_at:      c.published_at,
    dominant_category: pickDominant(c.id),
  }))
}

/** One badge surfaced on a product card — "this product appears in collection X". */
export interface ProductBadge {
  slug:            string
  title:           string
  /** 'comparison' | 'best_of' | 'general' | 'stack' — gift_guide intentionally excluded (routed by occasion). */
  collection_type: string
}

/**
 * Batch-fetch the collections each product appears in. Returns a Map keyed by
 * product_slug so listing pages can render badges per card without N+1 queries.
 *
 * Skipped collection types: 'gift_guide' (its public URL is keyed by occasion
 * slug, not by collection slug — would need OCCASIONS lookup to render an
 * href, and gift guides have their own discovery surface via /gifts).
 *
 * Limit per product is enforced in JS post-group so the underlying query can
 * cover many products in one round-trip; cap is the `max` argument.
 */
export async function getBadgesByProductSlug(
  supabase:     SupabaseClient,
  productSlugs: string[],
  max:          number = 3,
): Promise<Map<string, ProductBadge[]>> {
  const out = new Map<string, ProductBadge[]>()
  const slugs = [...new Set(productSlugs.filter(Boolean))]
  if (slugs.length === 0) return out

  // Single query: collection_items → collections (filtered to non-gift visible)
  // joined to reviews (filtered to the requested product slugs). Postgres does
  // the work; we group + cap in JS.
  const { data } = await supabase
    .from('collection_items')
    .select(`
      reviews!inner(product_slug),
      collections!inner(slug, title, collection_type, is_visible, published_at)
    `)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .in('reviews.product_slug', slugs as any)
    .eq('collections.is_visible', true)
    .neq('collections.collection_type', 'gift_guide')
    .order('published_at', { ascending: false, referencedTable: 'collections' })

  type Row = {
    reviews: { product_slug: string | null } | { product_slug: string | null }[] | null
    collections: {
      slug: string
      title: string
      collection_type: string
      is_visible: boolean
      published_at: string | null
    } | { slug: string; title: string; collection_type: string; is_visible: boolean; published_at: string | null }[] | null
  }
  const rows = (data ?? []) as Row[]

  for (const row of rows) {
    const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews
    const coll   = Array.isArray(row.collections) ? row.collections[0] : row.collections
    if (!review?.product_slug || !coll) continue
    const list = out.get(review.product_slug) ?? []
    if (list.length >= max) continue
    list.push({ slug: coll.slug, title: coll.title, collection_type: coll.collection_type })
    out.set(review.product_slug, list)
  }

  return out
}
