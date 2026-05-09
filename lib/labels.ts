// Display labels for canonical internal entities.
//
// Internal names (DB tables, route segments, status values, variable names)
// stay stable forever. Display labels live here so a rename — like
// "Wishlist" → "Bench" or "Articles" → "Guides" — changes in one place
// instead of leaking across nav, footer, emails, page titles, dashboards.
//
// Add a label here when:
//   - The display name differs from the internal name (wishlist_items → "Bench")
//   - Phrasing varies between contexts ("Bench" vs "On the Bench")
//   - The same label appears in 5+ places
//
// Do NOT add labels for body copy, article text, or one-off page strings.
// Do NOT centralize the brand name "Boss Daddy" — it's stable.

export const LABELS = {
  // wishlist_items table → /bench public route
  bench: {
    short: 'Bench',
    full: 'On the Bench',
    addCta: 'Add to Bench',
  },

  // products table → /stuff public route
  stuff: {
    short: 'Stuff',
    full: 'Boss Daddy Approved Gear',
  },

  // pick_lists table → /picks public route
  picks: {
    short: 'Picks',
    full: 'Boss Daddy Picks',
  },

  // guides table (formerly articles) → /guides
  guides: {
    singular: 'Guide',
    plural: 'Guides',
  },

  // reviews table → /reviews
  reviews: {
    singular: 'Review',
    plural: 'Reviews',
  },

  // gift_guides → /gifts
  gifts: {
    short: 'Gifts',
    full: 'Gift Guides',
  },
} as const
