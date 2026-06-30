import { z } from 'zod'
import { CATEGORY_SLUGS } from '@/lib/categories'

// Shared review validation schemas. Routes import these instead of
// re-declaring drifting copies (see workspace-unification Phase 0).
//
// No `.refine()` here — keep these base schemas refine-free so callers can
// safely `.partial()`/extend them without tripping the Zod v4 partial+refine
// module-eval crash (feedback_zod_v4_partial_with_refine).

export const CategorySchema = z.enum(CATEGORY_SLUGS as [string, ...string[]])

export const ReviewFaqSchema = z.object({ question: z.string(), answer: z.string() })

export const TESTING_DURATIONS = [
  '<1wk', '1-4wks', '1-3mo', '3+mo', '6mo', '1yr', '2yr', '3yr', '5yr', 'custom',
] as const

// POST /api/reviews — create a draft.
export const CreateReviewSchema = z.object({
  title: z.string().min(10).max(120),
  product_name: z.string().min(2).max(120),
  category: CategorySchema,
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  disclosure_acknowledged: z.boolean(),
  image_url: z.string().url().optional().nullable(),
  product_slug: z.string().max(80).optional().nullable(),
  comparison_product_slugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(4).default([]),
  tldr: z.string().max(600).optional().nullable(),
  key_takeaways: z.array(z.string()).default([]),
  best_for: z.array(z.string()).default([]),
  not_for: z.array(z.string()).default([]),
  faqs: z.array(ReviewFaqSchema).default([]),
  testing_duration: z.enum(TESTING_DURATIONS).optional().nullable(),
  testing_since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  testing_note: z.string().max(120).optional().nullable(),
  how_you_used_it: z.string().max(600).optional().nullable(),
  standout_moment: z.string().max(600).optional().nullable(),
  price_paid_cents: z.number().int().min(0).optional().nullable(),
  score_quality:    z.number().int().min(1).max(10).optional().nullable(),
  score_value:      z.number().int().min(1).max(10).optional().nullable(),
  score_ease:       z.number().int().min(1).max(10).optional().nullable(),
  score_daily_use:  z.number().int().min(1).max(10).optional().nullable(),
  would_rebuy:      z.boolean().optional().nullable(),
  suggested_tags: z.array(z.string().max(80)).max(10).default([]),
})

// PUT /api/reviews/[id] — partial author/admin update.
export const ReviewUpdateSchema = z.object({
  title:                    z.string().min(10).max(120).optional(),
  product_name:             z.string().min(2).max(120).optional(),
  category:                 CategorySchema.optional(),
  excerpt:                  z.string().max(200).optional(),
  content:                  z.string().min(100).optional(),
  pros:                     z.array(z.string()).optional(),
  cons:                     z.array(z.string()).optional(),
  disclosure_acknowledged:  z.boolean().optional(),
  image_url:                z.string().url().optional().nullable(),
  meta_title:               z.string().max(70).optional().nullable(),
  meta_description:         z.string().max(200).optional().nullable(),
  scheduled_publish_at:     z.string().datetime().optional().nullable(),
  product_slug:             z.string().regex(/^[a-z0-9-]+$/).max(120).optional().nullable(),
  comparison_product_slugs: z.array(z.string().regex(/^[a-z0-9-]+$/).max(80)).max(4).optional(),
  tldr:                     z.string().max(600).optional().nullable(),
  key_takeaways:            z.array(z.string()).optional(),
  best_for:                 z.array(z.string()).optional(),
  not_for:                  z.array(z.string()).optional(),
  faqs:                     z.array(ReviewFaqSchema).optional(),
  testing_duration:         z.enum(TESTING_DURATIONS).optional().nullable(),
  testing_since:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  testing_note:             z.string().max(120).optional().nullable(),
  how_you_used_it:          z.string().max(600).optional().nullable(),
  standout_moment:          z.string().max(600).optional().nullable(),
  price_paid_cents:         z.number().int().min(0).optional().nullable(),
  score_quality:            z.number().int().min(1).max(10).optional().nullable(),
  score_value:              z.number().int().min(1).max(10).optional().nullable(),
  score_ease:               z.number().int().min(1).max(10).optional().nullable(),
  score_daily_use:          z.number().int().min(1).max(10).optional().nullable(),
  score_specs:              z.number().int().min(1).max(10).optional().nullable(),
  specs_grade_rationale:    z.string().max(2000).optional().nullable(),
  specs_grade_data:         z.object({
    comparedAgainst: z.array(z.object({
      name:     z.string().max(120),
      brand:    z.string().max(120).nullable().optional(),
      keySpecs: z.array(z.object({ label: z.string().max(60), value: z.string().max(200) })).max(12).default([]),
      sourceUrl: z.string().max(500).nullable().optional(),
    })).max(8).default([]),
    sources:  z.array(z.object({ title: z.string().max(200), url: z.string().max(500) })).max(12).default([]),
    gradedAt: z.string().max(40).optional(),
  }).optional().nullable(),
  would_rebuy:              z.boolean().optional().nullable(),
  verdict_change:           z.enum(['improved', 'unchanged', 'declined', 'complete_reversal']).optional().nullable(),
})

// PUT /api/reviews/[id] — admin moderation action (alternative body shape).
export const ReviewModerateSchema = z.object({
  action: z.enum(['approve', 'reject', 'request_edits', 'unpublish', 'toggle_visibility']),
  rejection_reason: z.string().optional(),
})
