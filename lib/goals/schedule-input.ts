// Translates the schedule picker's answers into an RFC 5545 RRULE.
//
// This is the seam that lets the UI stay four radio buttons and seven checkboxes
// while the schema stores a real recurrence rule. It lives in lib/ rather than in
// the route handler because it's the load-bearing translation between what a dad
// clicked and what the cron will expand for the next several years — worth
// testing directly.

/** Canonical BYDAY order, Monday-first to match RFC 5545's default WKST=MO. */
export const DAY_TOKENS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

export type WhenChoice = 'daily' | 'weekdays' | 'days' | 'monthly'

/**
 * Dedupes and sorts submitted days into canonical order, dropping anything that
 * isn't a real token.
 *
 * Browsers send checkbox values in DOM order, and a hand-rolled POST can send
 * anything at all. Normalizing means two identical schedules always produce
 * byte-identical RRULEs — without that, comparing or debugging two rules that
 * behave the same is guesswork.
 */
export function normalizeDays(raw: string[]): string[] {
  const picked = new Set(raw)
  return DAY_TOKENS.filter((token) => picked.has(token))
}

/**
 * Builds the RRULE body (no `RRULE:` prefix — lib/goals/recurrence.ts adds it).
 *
 *   daily     → FREQ=DAILY
 *   weekdays  → FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
 *   days      → FREQ=WEEKLY;BYDAY=<canonical picks>, or FREQ=DAILY if all seven
 *   monthly   → FREQ=MONTHLY;BYMONTHDAY=<day of startDate>
 *
 * `monthly` pins BYMONTHDAY from the start date so "the 8th" stays the 8th
 * instead of drifting through months of unequal length.
 *
 * All seven days collapses to FREQ=DAILY: identical occurrences, simpler rule,
 * and it reads honestly if the user ever sees it.
 *
 * A single day is a weekly rule, which is how "weigh in on Sundays" works with
 * no separate weekly option in the UI.
 */
export function buildRrule(when: WhenChoice, startDate: string, days: string[]): string {
  switch (when) {
    case 'weekdays':
      return 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'
    case 'days': {
      const picks = normalizeDays(days)
      if (picks.length === 0) return 'FREQ=DAILY'   // caller rejects this first
      if (picks.length === 7) return 'FREQ=DAILY'
      return `FREQ=WEEKLY;BYDAY=${picks.join(',')}`
    }
    case 'monthly':
      return `FREQ=MONTHLY;BYMONTHDAY=${Number(startDate.slice(8, 10))}`
    default:
      return 'FREQ=DAILY'
  }
}
