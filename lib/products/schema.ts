import { z } from 'zod'

// Shared product validation schemas. Routes import these instead of
// re-declaring drifting copies (see workspace-unification Phase 0).
//
// No `.refine()` here — keep these base schemas refine-free so callers can
// safely `.partial()`/extend them without tripping the Zod v4 partial+refine
// module-eval crash (feedback_zod_v4_partial_with_refine).

export const SpecSchema = z.object({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(200),
})

export const PRODUCT_STATUSES = [
  'considering', 'queued', 'testing', 'reviewed', 'passed', 'archived',
] as const

// Fields shared verbatim between create and update (same optionality).
const sharedProductFields = {
  brand:                 z.string().max(120).optional().nullable(),
  asin:                  z.string().max(20).optional().nullable(),
  custom_store_name:     z.string().max(80).optional().nullable(),
  affiliate_url:         z.string().url().max(2048).optional().nullable(),
  non_affiliate_url:     z.string().url().max(2048).optional().nullable(),
  image_url:             z.string().url().max(2048).optional().nullable(),
  description:           z.string().max(400).optional().nullable(),
  category:              z.string().max(80).optional().nullable(),
  price_cents:           z.number().int().min(0).optional().nullable(),
  // Bench pipeline fields (folded in from the former wishlist admin).
  estimated_review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  skip_reason:           z.string().max(500).optional().nullable(),
}

// POST /api/admin/products — create. Defaults applied at insert time.
export const ProductCreateSchema = z.object({
  slug:     z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only'),
  name:     z.string().min(2).max(160),
  specs:    z.array(SpecSchema).max(30).optional().default([]),
  store:    z.string().max(40).optional().default('amazon'),
  status:   z.enum(PRODUCT_STATUSES).optional().default('considering'),
  priority: z.number().int().optional().default(0),
  ...sharedProductFields,
})

// PATCH /api/admin/products/[id] — partial update. Everything optional, no defaults.
export const ProductUpdateSchema = z.object({
  slug:     z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  name:     z.string().min(2).max(160).optional(),
  specs:    z.array(SpecSchema).max(30).optional(),
  store:    z.string().max(40).optional(),
  status:   z.enum(PRODUCT_STATUSES).optional(),
  priority: z.number().int().optional(),
  ...sharedProductFields,
})
