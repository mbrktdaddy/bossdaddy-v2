// Shared safety-rule clauses appended to every AI image prompt, and the lane
// presets that decide what is allowed WHERE an image is used (plan §6, allowance
// table in docs/brand-guide.md §2 "Images").
//
// Doctrine:
//   • `noBrands` is ALWAYS enforced — the model must never render a logo,
//     packaging, or a recognisable real-world product (trademark safety, and
//     the "AI never replicates the product" rule in memory).
//   • Children are never identifiable, in any lane, whenever people may appear.
//   • `people` is a three-level policy, not a boolean. A dad-and-kids site
//     starves on "no people"; the risk was never a figure, it was an AI FACE —
//     the uncanny-valley tell that reads as a fake testimonial next to a
//     first-person "I tested this" voice. `anonymous` keeps the warmth (hands,
//     a figure from behind, a face out of frame) without the face.
//   • Text in an AI image is the other tell and the site composes text in code
//     (the OG route), so editorial lanes block it; the social lane may allow it.
//
// Editorial lanes (hero + body figures) use EDITORIAL; the media library, X
// Studio and social use SOCIAL_FLEXIBLE. Vision QA (lib/images/qa.ts) judges
// the result against the same toggles.

export type PeoplePolicy = 'none' | 'anonymous' | 'allowed'

export type SafetyToggles = {
  /** Block product replicas, brand names, logos, packaging, trademarks. Pinned on. */
  noBrands: boolean
  /** Block rendered text, lettering, signage, watermarks. */
  noText: boolean
  /** Whether and how people may appear. */
  people: PeoplePolicy
  /** Force a candid editorial-scene framing (never a studio product shot). */
  editorialOnly: boolean
}

export const PEOPLE_POLICIES: readonly PeoplePolicy[] = ['none', 'anonymous', 'allowed'] as const

// Hero + body figures on reviews, guides and collections.
export const EDITORIAL: SafetyToggles = {
  noBrands: true,
  noText: true,
  people: 'anonymous',
  editorialOnly: true,
}

// The strict variant (no people at all) — the pre-2026-10-23 hero rule, kept
// as a named preset for callers that want objects-and-setting only.
export const EDITORIAL_STRICT: SafetyToggles = {
  ...EDITORIAL,
  people: 'none',
}

// Social posts, media library, X Studio — brands still blocked (trademark
// safety) but text and people are allowed by default.
export const SOCIAL_FLEXIBLE: SafetyToggles = {
  noBrands: true,
  noText: false,
  people: 'allowed',
  editorialOnly: false,
}

export function isPeoplePolicy(v: unknown): v is PeoplePolicy {
  return typeof v === 'string' && (PEOPLE_POLICIES as readonly string[]).includes(v)
}

/**
 * Merge caller-supplied toggles over a preset baseline. `noBrands` is pinned on
 * regardless of what the caller passes — relaxing it is not an option we expose.
 * Only explicitly-set keys apply: an `undefined` override must NOT clobber the
 * baseline (a client that omits `noText` keeps the preset default).
 */
export function resolveToggles(
  base: SafetyToggles,
  overrides?: Partial<SafetyToggles>,
): SafetyToggles {
  const merged: SafetyToggles = { ...base }
  if (overrides) {
    if (typeof overrides.noText === 'boolean') merged.noText = overrides.noText
    if (typeof overrides.editorialOnly === 'boolean') merged.editorialOnly = overrides.editorialOnly
    if (isPeoplePolicy(overrides.people)) merged.people = overrides.people
  }
  merged.noBrands = true // pinned on regardless of caller input
  return merged
}

/** The legacy `no_people` boolean the social-lane clients still send. */
export function peopleFromLegacy(noPeople: boolean | undefined, fallback: PeoplePolicy): PeoplePolicy {
  if (noPeople === true) return 'none'
  if (noPeople === false) return 'allowed'
  return fallback
}

/**
 * Build the safety-rule text block appended to an image prompt. Never empty:
 * `noBrands` is pinned, so at least the brand clause is present.
 */
export function buildSafetyRules(toggles: SafetyToggles): string {
  const clauses: string[] = []

  if (toggles.noBrands) {
    clauses.push(
      'NO specific product replicas, NO brand names, NO logos, ' +
        'NO product packaging or labels visible, NO trademarks, ' +
        'NO recognisable real-world products',
    )
  }
  if (toggles.noText) {
    clauses.push('NO text, lettering, numbers, signage, labels or watermarks anywhere in the frame')
  }
  if (toggles.people === 'none') {
    clauses.push('NO people, no hands, no body parts')
  } else if (toggles.people === 'anonymous') {
    clauses.push(
      'People may appear ONLY anonymously — hands, a figure from behind, out of focus, or with the face out of frame; ' +
        'NEVER a visible face, never a recognisable person',
    )
  }
  if (toggles.people !== 'none') {
    clauses.push('Any child in the frame must be unidentifiable (face turned away, out of frame, or out of focus)')
  }
  if (toggles.editorialOnly) {
    clauses.push('A candid editorial scene in a real-world setting — not a studio product shot, not a product replica')
  }

  return `Strict rules: ${clauses.join('. ')}.`
}
