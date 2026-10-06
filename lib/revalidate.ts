import { revalidatePath } from 'next/cache'

/**
 * Boss Daddy v2 — public-surface revalidation.
 *
 * Every public listing page is ISR (`export const revalidate = 3600`), so a
 * newly-published piece is invisible for up to an hour unless the mutating
 * route explicitly purges the pages it appears on.
 *
 * That list was previously re-derived by hand at each call site, and the guide
 * routes all forgot the two category surfaces — `/category/<cat>` and
 * `/guides/category/<cat>` — which the review routes remembered. Result: a
 * guide published to Table Duty showed up on `/` and `/guides` immediately but
 * took up to 60 minutes to appear on either category page. Keep the answer here
 * so it can only be wrong in one place.
 *
 * **Pass the previous category too on an edit.** Re-categorising a live piece
 * has to purge the category it LEFT as well as the one it joined, or the old
 * category page keeps listing it for an hour.
 */

type ContentRef = { slug?: string | null; category?: string | null }

function categoryPaths(
  items: ContentRef[],
  extraCategories: (string | null | undefined)[],
  detailPrefix: 'guides' | 'reviews',
) {
  const cats = new Set<string>()
  for (const item of items) if (item.category) cats.add(item.category)
  for (const c of extraCategories) if (c) cats.add(c)

  for (const cat of cats) {
    // The shared cross-content hub (guides + reviews both surface here)…
    revalidatePath(`/category/${cat}`)
    // …and the type-specific listing.
    revalidatePath(`/${detailPrefix}/category/${cat}`)
  }
}

/**
 * Purge every public page a guide appears on.
 *
 * @param items            the affected guides (need `slug` + `category`)
 * @param extraCategories  categories to purge beyond the items' current ones —
 *                         pass the PREVIOUS category when an edit moved a guide
 */
export function revalidateGuidePaths(
  items: ContentRef[],
  extraCategories: (string | null | undefined)[] = [],
) {
  revalidatePath('/')
  revalidatePath('/guides')
  revalidatePath('/about')
  for (const g of items) if (g.slug) revalidatePath(`/guides/${g.slug}`)
  categoryPaths(items, extraCategories, 'guides')
}

/**
 * Purge every public page a review appears on.
 *
 * @param items            the affected reviews (need `slug` + `category`)
 * @param extraCategories  categories to purge beyond the items' current ones —
 *                         pass the PREVIOUS category when an edit moved a review
 */
export function revalidateReviewPaths(
  items: ContentRef[],
  extraCategories: (string | null | undefined)[] = [],
) {
  revalidatePath('/')
  revalidatePath('/reviews')
  revalidatePath('/gear')
  revalidatePath('/about')
  for (const r of items) if (r.slug) revalidatePath(`/reviews/${r.slug}`)
  categoryPaths(items, extraCategories, 'reviews')
}

/**
 * Purge every public page a product (a Bench or Radar item) appears on.
 *
 * Products render on the Bench (listing + detail), the /gear hub (Radar lane +
 * Bench strip) and the Bench strips on `/` and `/reviews`. The admin product
 * routes used to purge none of these, so a Bench edit sat stale for up to an
 * hour. Detail pages are purged by route pattern, which also covers a slug
 * rename (the old slug's page is purged too).
 */
export function revalidateProductPaths() {
  revalidatePath('/')
  revalidatePath('/reviews')
  revalidatePath('/gear')
  revalidatePath('/bench')
  revalidatePath('/(public)/bench/[slug]', 'page')
  revalidatePath('/(public)/gear/category/[slug]', 'page')
  // Collections render product-only items with the product's claims (stage,
  // "Bought it", the provided-unit disclosure — mig 158).
  revalidatePath('/(public)/picks/[slug]', 'page')
  revalidatePath('/(public)/stacks/[slug]', 'page')
  revalidatePath('/(public)/gifts/[occasion]', 'page')
}

/**
 * Purge every public page merch appears on: the store (/shop + detail pages),
 * the MerchStrip on `/`, `/gear` and `/about`, and the MerchCallout at the foot
 * of every review and guide. The merch admin and Printful sync/publish routes
 * used to purge none of these.
 */
export function revalidateMerchPaths() {
  revalidatePath('/shop')
  revalidatePath('/(public)/shop/[slug]', 'page')
  revalidatePath('/')
  revalidatePath('/gear')
  revalidatePath('/about')
  revalidatePath('/(public)/reviews/[slug]', 'page')
  revalidatePath('/(public)/guides/[slug]', 'page')
}
