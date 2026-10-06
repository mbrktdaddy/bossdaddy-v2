import type { SupabaseClient } from '@supabase/supabase-js'

// Product-only collection items (mig 110) reference a product, not a review.
// These helpers keep how they render honest as the product moves along
// (brand-guide §1.9: claims only when set).

/** The product columns a product-only card needs to decide its claims. */
export const PRODUCT_CLAIM_COLUMNS = 'status, acquisition, provided_by'

/**
 * Upgrade product-only items whose product has since earned an approved,
 * visible top-level review: the item renders as the full review card instead of
 * a bare product card. Without this, a showcased product kept its product card
 * forever after its review published. Mutates `items` in place.
 *
 * `reviewSelect` must match the page's own `reviews(...)` join columns (and
 * include `product_slug`), so an upgraded item has the same shape as a
 * review-backed one.
 */
export async function upgradeReviewedProducts<R>(
  client: SupabaseClient,
  items: { review: R | null; product: { slug: string } | null }[],
  reviewSelect: string,
): Promise<void> {
  const slugs = [...new Set(items.filter((i) => !i.review && i.product).map((i) => i.product!.slug))]
  if (slugs.length === 0) return

  const { data, error } = await client
    .from('reviews')
    .select(reviewSelect)
    .in('product_slug', slugs)
    .is('parent_review_id', null)
    .eq('status', 'approved')
    .eq('is_visible', true)
  if (error) {
    console.error('upgradeReviewedProducts failed:', error)
    return
  }

  const bySlug = new Map(
    ((data ?? []) as unknown as (R & { product_slug: string })[]).map((r) => [r.product_slug, r]),
  )
  for (const item of items) {
    if (item.review || !item.product) continue
    const review = bySlug.get(item.product.slug)
    if (review) item.review = review
  }
}
