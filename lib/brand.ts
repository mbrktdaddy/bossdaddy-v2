// Canonical Boss Daddy brand strings — the ONE source for the messaging lines
// that render in the UI, metadata, and OG cards. Import from here instead of
// hardcoding, so a wording change is a single edit, not a multi-file hunt
// (retiring "Boss Dads. Built Different." touched ~10 files; this prevents that).
//
// Doctrine — voice, capitalization, when-to-use — lives in docs/brand-guide.md §1.
// These constants are the literal strings that doctrine describes; keep the two in
// sync (change a line here → update brand-guide §1.7, and vice versa).
//
// NOT here: the brand NAME "Boss Daddy" (intentionally never centralized — see
// CLAUDE.md naming doctrine) and design tokens (those live in app/globals.css).

export const BRAND = {
  /**
   * Positioning line (v3.5). Stored WITHOUT a trailing period so it reads
   * naturally mid-sentence ("men living The Boss Dad Standard"); add a period
   * when it stands alone as a display line.
   */
  positioning: 'The Boss Dad Standard',
  /** Primary tagline / rallying cry. Carries its period — it's almost always a standalone display line. */
  tagline: 'Dad Like a Boss.',
  /** Action line / motivational CTA verb. */
  actionLine: 'Boss Up.',
  /** Credibility line / trust proof. */
  credibility: 'Real Dads. Smart Tools. Better Decisions.',
  /** Merch / shop voice — store contexts only. */
  merchVoice: 'Boss Stuff for Boss Dads',
  /** One-line essence. */
  essence: 'Boss Daddy — the gold standard and trusted hub for men who Dad Like a Boss.',
  /** Canonical manifesto — do not paraphrase in hero/about placements. */
  manifesto:
    `Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for men living The Boss Dad Standard — men who believe being a proud and present father who shows up every day isn't a compromise of strength, but the ultimate expression of it.`,
} as const

/**
 * Split a line into its lead words and final word — for rendering the last word
 * in the accent color (e.g. the hero H1: "Dad Like a <accent>Boss.</accent>").
 */
export function splitLastWord(line: string): { lead: string; last: string } {
  const i = line.lastIndexOf(' ')
  return i === -1 ? { lead: '', last: line } : { lead: line.slice(0, i), last: line.slice(i + 1) }
}
