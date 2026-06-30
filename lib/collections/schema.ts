import { z } from 'zod'

// Shared collection ("picks") validation schemas. Routes import these instead
// of re-declaring drifting copies (see workspace-unification Phase 0).
//
// No `.refine()` here — keep these base schemas refine-free so callers can
// safely `.partial()`/extend them without tripping the Zod v4 partial+refine
// module-eval crash (feedback_zod_v4_partial_with_refine).

export const FaqSchema = z.array(
  z.object({
    question: z.string().min(3).max(200),
    answer:   z.string().min(3).max(1000),
  }),
).max(12)

export const COLLECTION_TYPES = [
  'general', 'gift_guide', 'best_of', 'comparison', 'stack',
] as const

// Fields shared verbatim between create and update (same optionality).
const sharedCollectionFields = {
  description:          z.string().max(500).optional().nullable(),
  intro_html:           z.string().max(10000).optional().nullable(),
  hero_image_url:       z.string().url().max(2048).optional().nullable(),
  published_at:         z.string().optional().nullable(),
  occasion:             z.string().max(40).optional().nullable(),
  winner_summary:       z.string().max(500).optional().nullable(),
  bundle_total_cents:   z.number().int().min(0).optional().nullable(),
  meta_title:           z.string().max(120).optional().nullable(),
  meta_description:     z.string().max(300).optional().nullable(),
  scheduled_publish_at: z.string().datetime().optional().nullable(),
  // Editorial overrides — migration 068. Null/empty falls back to the
  // dominant category's pov/faqs from lib/categories.ts on public pages.
  methodology_html:     z.string().max(10000).optional().nullable(),
  faqs:                 FaqSchema.optional().nullable(),
}

// POST /api/admin/picks — create.
export const PickListSchema = z.object({
  slug:            z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title:           z.string().min(2).max(160),
  is_visible:      z.boolean().optional().default(false),
  collection_type: z.enum(COLLECTION_TYPES).optional().default('general'),
  ...sharedCollectionFields,
})

export const CollectionItemSchema = z.object({
  review_id:     z.string().uuid(),
  position:      z.number().int(),
  blurb:         z.string().max(500).optional().nullable(),
  wins_category: z.string().max(80).optional().nullable(),
  role_label:    z.string().max(80).optional().nullable(),
  best_for:      z.string().max(120).optional().nullable(),  // migration 068
})

// PATCH /api/admin/picks/[id] — partial update, plus full item-list replacement.
export const CollectionUpdateSchema = z.object({
  slug:            z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  title:           z.string().min(2).max(160).optional(),
  is_visible:      z.boolean().optional(),
  collection_type: z.enum(COLLECTION_TYPES).optional(),
  ...sharedCollectionFields,
  items: z.array(CollectionItemSchema).optional(),
})
