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
  //
  // Reader-clarification copy: every surface that names the Bench out of
  // context (footer, ticker, BenchStrip, hover titles) should use one of
  // these taglines so the metaphor teaches itself.
  bench: {
    short:        'Bench',
    full:         'On the Bench',
    addCta:       'Add to Bench',
    // Long form — for /bench dek and hover tooltips. One sentence.
    tagline:      'Products lined up for testing — vote on what gets reviewed next.',
    // Invitation-style — for BenchStrip subhead on /reviews + /gear.
    shortTagline: 'Check out the upcoming items on our bench list',
  },

  // products table → /gear public route
  stuff: {
    short: 'Gear',
    full: 'Boss Daddy Approved Gear',
  },

  // collections table → /picks public route
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

  // comparison-type collections → /comparisons
  comparisons: {
    short: 'Comparisons',
    full: 'Head-to-Head Comparisons',
    singular: 'Comparison',
  },

  // stack-type collections → /stacks
  stacks: {
    short: 'Stacks',
    full: 'Boss Daddy Stacks',
    singular: 'Stack',
  },

  // Umbrella for all collection types — the brand surface that unifies
  // /picks, /comparisons, /stacks, /gifts under one discoverable home.
  vault: {
    short: 'Vault',
    full: 'The Vault',
  },
} as const
