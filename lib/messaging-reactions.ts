// The DM reaction vocabulary — the ONE map between the stable key stored in
// message_reactions.kind and the glyph a member sees.
//
// ── WHY EMOJI HERE, WHEN THE BRAND SAYS NO EMOJI ─────────────────────────────
// The rule (brand-guide §7.1, amended 2026-08-17) is no emoji as INTERFACE
// ICONOGRAPHY. A reaction isn't ours, it's theirs: emoji IS the vocabulary of
// reacting, and a hand-drawn outlined-SVG reaction set would be unrecognisable —
// it would make this the only messenger on earth with bespoke reactions. The test
// the brand guide gives: is the glyph ours (chrome) or theirs (content)? Theirs.
//
// ── WHY THE DB STORES 'strong' AND NOT 💪 ────────────────────────────────────
// Naming doctrine (CLAUDE.md): the internal name is stable forever, the display
// label is free to change. Storing the glyph would pin a unicode sequence into a
// CHECK constraint — '❤️' is U+2764 *plus* U+FE0F, and one missing variation
// selector between this file and the constraint is a silent insert failure that
// reproduces for exactly one reaction. Keys are ASCII; swapping which glyph
// 'strong' renders as is a one-line change here and touches no rows.
//
// SET IS SMALL AND FIXED ON PURPOSE (brand-guide §7.1): a handful, not a picker,
// so the row under a bubble stays a predictable-width UI element. Adding one means
// editing the CHECK in a migration too — that coupling is the point, it stops the
// vocabulary drifting to arbitrary stored text.

/** Stable keys. Must stay in step with migration 155's CHECK on `kind`. */
export const REACTION_KINDS = ['up', 'heart', 'laugh', 'strong', 'pray'] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]

interface Reaction {
  /** The glyph. Rendered at text size with NO colour treatment — emoji carry
   *  their own colour and tinting them fights the platform's own artwork. */
  emoji: string
  /** Accessible name. Screen readers announce emoji inconsistently, so every
   *  reaction button gets this as its label rather than the glyph. */
  label: string
}

// Chosen for this audience rather than copied wholesale from a generic set:
// 'strong' and 'pray' carry the archetype (Wise Warrior, grounded in faith) and
// are the two a man is most likely to want on a hard day's log. No 😮/😢 —
// surprise and sadness are the two a dad-to-dad thread least needs a one-tap
// shortcut for, and five keeps the row to one line on a 393px screen.
export const REACTIONS: Record<ReactionKind, Reaction> = {
  up:     { emoji: '👍',  label: 'Thumbs up' },
  heart:  { emoji: '❤️', label: 'Love' },
  laugh:  { emoji: '😂',  label: 'Funny' },
  strong: { emoji: '💪',  label: 'Strength' },
  pray:   { emoji: '🙏',  label: 'Praying' },
}

/** Narrow an untrusted string (form value, API body) to a known key. */
export function isReactionKind(value: unknown): value is ReactionKind {
  return typeof value === 'string' && (REACTION_KINDS as readonly string[]).includes(value)
}

/** The glyph for a key, or null if it isn't one we know — so a row written by a
 *  future migration this build hasn't shipped yet renders as nothing rather than
 *  crashing the thread. */
export function reactionEmoji(kind: string): string | null {
  return isReactionKind(kind) ? REACTIONS[kind].emoji : null
}
