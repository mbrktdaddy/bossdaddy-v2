// Shared safety-rule clauses appended to every AI image prompt.
//
// Doctrine: `noBrands` is ALWAYS enforced (trademark/brand safety — the model
// must never render recognizable logos, packaging, or real-world products).
// The `noText` and `noPeople` clauses are situational — hero/editorial imagery
// wants them off; social memes / quote-cards / lifestyle shots may want them.
//
// Callers pass a partial toggle set; `buildSafetyRules` fills the rest from the
// preset baseline. Hero routes use EDITORIAL_STRICT; social + media-library +
// inline-article generation use SOCIAL_FLEXIBLE.

export type SafetyToggles = {
  /** Block product replicas, brand names, logos, packaging, trademarks. Always recommended on. */
  noBrands: boolean
  /** Block rendered text, watermarks, captions baked into the image. */
  noText: boolean
  /** Block depictions of people. */
  noPeople: boolean
  /** Force a generic editorial-scene framing (no specific real-world subject). */
  editorialOnly: boolean
}

// Hero / editorial covers — the strict baseline (matches the pre-refactor rule).
export const EDITORIAL_STRICT: SafetyToggles = {
  noBrands: true,
  noText: true,
  noPeople: true,
  editorialOnly: true,
}

// Social posts, media library, inline article images — brands still blocked
// (trademark safety) but text and people are allowed by default.
export const SOCIAL_FLEXIBLE: SafetyToggles = {
  noBrands: true,
  noText: false,
  noPeople: false,
  editorialOnly: false,
}

/**
 * Merge caller-supplied toggles over a preset baseline. `noBrands` is pinned on
 * regardless of what the caller passes — relaxing it is not an option we expose.
 */
export function resolveToggles(
  base: SafetyToggles,
  overrides?: Partial<SafetyToggles>
): SafetyToggles {
  const merged: SafetyToggles = { ...base }
  if (overrides) {
    // Only apply explicitly-set keys — an `undefined` override must NOT clobber
    // the baseline (e.g. a client that omits no_text keeps the preset default).
    for (const key of Object.keys(overrides) as (keyof SafetyToggles)[]) {
      const val = overrides[key]
      if (typeof val === 'boolean') merged[key] = val
    }
  }
  merged.noBrands = true // pinned on regardless of caller input
  return merged
}

/**
 * Build the safety-rule text block appended to an image prompt. Returns an empty
 * string only in the (impossible, since noBrands is pinned) case of no active
 * clauses.
 */
export function buildSafetyRules(toggles: SafetyToggles): string {
  const clauses: string[] = []

  if (toggles.noBrands) {
    clauses.push(
      'NO specific product replicas, NO brand names, NO logos, ' +
        'NO product packaging or labels visible, NO trademarks, ' +
        'NO recognizable real-world products'
    )
  }
  if (toggles.noText) {
    clauses.push('NO text, NO watermarks')
  }
  if (toggles.noPeople) {
    clauses.push('NO people')
  }
  if (toggles.editorialOnly) {
    clauses.push('Generate a generic editorial scene only')
  }

  if (clauses.length === 0) return ''
  return `Strict rules: ${clauses.join(', ')}.`
}
