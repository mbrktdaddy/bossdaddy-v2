import { z } from 'zod'
import { LABELS } from '@/lib/labels'
import { RADAR_TAKE_MAX } from '@/lib/products'
import { TESTING_NOTE_MAX } from '@/lib/products/testing-notes'

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
  'catalog', 'radar', 'queued', 'testing', 'reviewed', 'passed', 'archived',
] as const

export const ACQUISITIONS = ['purchased', 'provided', 'loaner'] as const

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
  // On the Radar (mig 157). The take is kept when the product moves on, for the
  // archive. spotted_at is never nullable here: the trigger stamps it on entry
  // into Radar, an explicit value schedules the release, and clearing it would
  // either break the Radar CHECK or erase the archive's date.
  radar_take:            z.string().max(RADAR_TAKE_MAX).optional().nullable(),
  spotted_at:            z.iso.datetime({ offset: true }).optional(),
  // How I got it (mig 158). null = no claim.
  acquisition:           z.enum(ACQUISITIONS).optional().nullable(),
  provided_by:           z.string().max(120).optional().nullable(),
}

// Postgres CHECK violations (23514) the admin can cause with valid-looking
// input. Mapped to a readable 400 instead of a raw 500.
const CHECK_MESSAGES: Record<string, string> = {
  products_radar_requires_take: `A ${LABELS.radar.short} item needs a take before it can go live.`,
  products_radar_take_length:   `The ${LABELS.radar.short} take is capped at ${RADAR_TAKE_MAX} characters.`,
}

/** A readable message for a product CHECK violation, or null if `error` isn't one. */
export function productCheckViolation(error: { code?: string; message: string }): string | null {
  if (error.code !== '23514') return null
  const hit = Object.keys(CHECK_MESSAGES).find((name) => error.message.includes(name))
  return hit ? CHECK_MESSAGES[hit] : `Invalid product: ${error.message}`
}

// POST /api/admin/products — create. Defaults applied at insert time.
export const ProductCreateSchema = z.object({
  slug:     z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only'),
  name:     z.string().min(2).max(160),
  specs:    z.array(SpecSchema).max(30).optional().default([]),
  store:    z.string().max(40).optional().default('amazon'),
  // catalog = private, no claim (mig 158). A public stage is always a choice.
  status:   z.enum(PRODUCT_STATUSES).optional().default('catalog'),
  priority: z.number().int().optional().default(0),
  // Topic/facet tags (product_tags join, mig 122). Not a products column —
  // the route attaches these to product_tags separately after the row exists.
  tags:     z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).optional().default([]),
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
  // undefined = leave tags untouched; [] = clear all. Handled separately from
  // the products column update (product_tags join, mig 122).
  tags:     z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20).optional(),
  ...sharedProductFields,
})

// Testing notes (mig 158) — dated public field notes on a product under test.

export const TestingNoteCreateSchema = z.object({
  noted_on: z.iso.date(),
  body:     z.string().trim().min(1).max(TESTING_NOTE_MAX),
})

export const TestingNoteUpdateSchema = TestingNoteCreateSchema.partial()
