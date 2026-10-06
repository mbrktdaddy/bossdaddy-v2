// Testing notes (mig 158): dated public field notes on a product under test —
// "Week 2: battery's holding up". Plain text, admin-authored.

// Mirrors the body-length CHECK (mig 158). Here, not in schema.ts, so the
// client panel can read it without pulling zod.
export const TESTING_NOTE_MAX = 1000

export interface TestingNote {
  id: string
  product_id: string
  /** YYYY-MM-DD — the day the note describes. */
  noted_on: string
  body: string
  created_at: string
  updated_at: string
}

export type TestingNoteWithWeek = TestingNote & { week: number }

const DAY_MS = 86_400_000

// Date-only strings parsed as UTC midnight, so the week count never depends on
// the server's or the browser's time zone.
function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS)
}

/** "Oct 6, 2026" — formatted in UTC so server and browser render the same day. */
export function formatNoteDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Number each note "Week N", counted from the product's earliest note (week 1).
 * Nothing records when testing started, so the first note is the start. Returns
 * newest first; same-day notes keep their written order (newest first).
 */
export function withWeeks(notes: TestingNote[]): TestingNoteWithWeek[] {
  if (notes.length === 0) return []
  const first = Math.min(...notes.map((n) => dayNumber(n.noted_on)))
  return notes
    .map((n) => ({ ...n, week: Math.floor((dayNumber(n.noted_on) - first) / 7) + 1 }))
    .sort((a, b) => b.noted_on.localeCompare(a.noted_on) || b.created_at.localeCompare(a.created_at))
}
