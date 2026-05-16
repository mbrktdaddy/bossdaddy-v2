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
