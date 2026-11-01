// The two image tiers — the ONLY place an OpenAI image model is named.
//
// WHY THE PINS EXIST: the Images API has no alias we can safely float on. The
// house style (lib/images/style.ts), the vision QA (lib/images/qa.ts) and the
// cost chip (lib/ai/pricing.ts) are tuned and keyed per model, so a moving
// "latest" would quietly change the look of the public page and break the price
// lookup. Pinning is right — but a pin rots: OpenAI retires models on a calendar,
// and a retired pin 400s at runtime.
//
// SHUTDOWN DATES (OpenAI deprecations page, verified 2026-10-31):
//   gpt-image-1        shutdown 2026-10-23  (our old Draft tier)
//   gpt-image-1.5      shutdown 2026-12-01  (our old Publication tier)
//   gpt-image-1-mini   shutdown 2026-12-01
// OpenAI's replacements are gpt-image-2.5-sunburst (editing precision, now the
// Publication tier) and gpt-image-2.5-flare (fast everyday generation, now the
// Draft tier).
//
// `npm run images:check` (scripts/image-model-check.mjs) reads the pins out of
// this file and verifies each one live against OpenAI; add `-- --generate` to
// also prove the Images API still accepts our request shape (about a cent). Run
// it after any bump here and whenever OpenAI posts a deprecation.
//
// Client-safe on purpose: plain data, no server imports. The panels read `label`
// and `hint` from here, so a button can never name a model the server no longer
// calls. Keep each pin a plain single-quoted literal — the check script extracts
// them by pattern.

export type ImageTier = 'publication' | 'draft'

export interface ImageTierSpec {
  /** The raw OpenAI model id. The generations log prefixes it as `openai/<id>`. */
  model: string
  quality: 'low' | 'medium' | 'high'
  /** Button text in the panels. */
  label: string
  /** Tooltip: model, quality and what the tier is for. */
  hint: string
}

// Publication is the default for the editorial lane (the public page gets the
// highest quality; the panels start on it). Draft is the knob for roughing out a
// composition or a prompt before spending on the real thing.
export const IMAGE_TIERS: Readonly<Record<ImageTier, ImageTierSpec>> = {
  publication: { model: 'gpt-image-2.5-sunburst', quality: 'high',   label: 'Publication', hint: 'gpt-image-2.5 Sunburst · high — the publication tier' },
  draft:       { model: 'gpt-image-2.5-flare',    quality: 'medium', label: 'Draft',       hint: 'gpt-image-2.5 Flare · medium — cheap, for roughing out a composition' },
}

/** Every model the app calls — exactly what `npm run images:check` verifies. */
export const PINNED_IMAGE_MODELS: readonly string[] = [IMAGE_TIERS.publication.model, IMAGE_TIERS.draft.model]

/** `premium` is the long-standing request flag: true selects the Publication tier. */
export function tierFor(premium: boolean): ImageTier {
  return premium ? 'publication' : 'draft'
}

/**
 * The contact sheet: three cheap Draft-model renders at low quality, to pick a
 * composition before the Publication render. The model is the Draft tier's own
 * (referenced, never re-typed, so `images:check` and a pin bump stay one edit).
 */
export const CONTACT_SHEET: ImageTierSpec = { model: IMAGE_TIERS.draft.model, quality: 'low', label: 'Sheet', hint: 'gpt-image-2.5 Flare · low — three cheap drafts to pick a composition from' }
export const CONTACT_SHEET_COUNT = 3
