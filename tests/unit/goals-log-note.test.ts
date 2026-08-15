import { describe, it, expect } from 'vitest'
import { normalizeEntryNote, MAX_ENTRY_NOTE_LENGTH } from '@/lib/goals/log'

// `goal_entries.note` has no database CHECK behind it — unlike `goal_notes`, which
// migration 145 constrains to 1–4000 — and the off-day writer trusted the form's
// `maxLength` alone. Now that two surfaces write this column, the normalizer is the
// only gate, so it gets tested directly.

describe('normalizeEntryNote', () => {
  it('keeps an ordinary note verbatim', () => {
    expect(normalizeEntryNote('Did it fasted, felt strong')).toBe('Did it fasted, felt strong')
  })

  it('treats absent, empty and whitespace-only as no note', () => {
    // A whitespace-only note must not masquerade as set — the Log renders a note
    // block whenever the column is non-null, and an empty one would be a stray row.
    expect(normalizeEntryNote(null)).toBeNull()
    expect(normalizeEntryNote(undefined)).toBeNull()
    expect(normalizeEntryNote('')).toBeNull()
    expect(normalizeEntryNote('   \n  ')).toBeNull()
  })

  it('stores pasted markup as text, not as markup', () => {
    // Not the XSS gate — notes render as escaped JSX text. This is why a paste
    // doesn't get stored as a tag and read back as literal angle brackets later.
    expect(normalizeEntryNote('<b>back tweaked</b>')).toBe('back tweaked')
    expect(normalizeEntryNote('<script>alert(1)</script>ok')).toBe('ok')
  })

  it('truncates rather than refusing an over-length note', () => {
    // These writes come from Promise<void> Server Actions with no channel to
    // explain a rejection, and for a medication log a shortened note beats a save
    // that silently did nothing.
    const long = 'a'.repeat(MAX_ENTRY_NOTE_LENGTH + 50)
    const out = normalizeEntryNote(long)
    expect(out).toHaveLength(MAX_ENTRY_NOTE_LENGTH)
  })

  it('does not leave trailing whitespace after truncating', () => {
    const out = normalizeEntryNote(`${'a'.repeat(MAX_ENTRY_NOTE_LENGTH - 1)} tail`)
    expect(out).toBe('a'.repeat(MAX_ENTRY_NOTE_LENGTH - 1))
  })

  it('caps at the number both note inputs render', () => {
    // The form's maxLength and this constant are the same value on purpose: if they
    // drift, users get silently truncated by a limit no input told them about.
    expect(MAX_ENTRY_NOTE_LENGTH).toBe(280)
  })
})
