// Canonical calendar-day helpers. Dependency-free on purpose: this is imported
// by client components, so it must not drag `rrule-temporal` (via
// lib/goals/recurrence) into a browser bundle.
//
// WHY THIS FILE EXISTS
// Three different "what day is it" idioms had grown up side by side, and they
// disagree — which is a defect, not a style question:
//
//   1. `localDateInZone(now, zone)`     — correct; was only in lib/goals
//   2. `dateToYMD(new Date())`          — the PROCESS zone, i.e. UTC on Vercel
//   3. `toISOString().slice(0, 10)`     — always UTC, drifts from the user's
//                                         "today" every evening west of GMT
//
// The savings streak read 0 for 7 hours a night because writes used the
// browser's local date and reads used (2). See audit findings #5, #34, #60.
//
// Rule: never derive a day key from a bare `new Date()`. Always name the zone.

/** True if the runtime's ICU data recognises this IANA zone. */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone) return false
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone })
    return true
  } catch {
    return false
  }
}

/**
 * The calendar date at `instant`, as seen in `timeZone`, as `YYYY-MM-DD`.
 *
 * `en-CA` because it formats as YYYY-MM-DD natively; `formatToParts` rather
 * than string-splitting so a locale or ICU change can't silently reorder it.
 *
 * Throws a RangeError on an unknown zone — callers that accept untrusted input
 * (a request header, say) should validate first or catch.
 */
export function localDateInZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * `YYYY-MM-DD` → a Date at LOCAL midnight of that calendar day.
 *
 * Deliberately not `new Date('YYYY-MM-DD')`, which V8 parses as UTC midnight
 * and therefore lands on the previous day for anyone west of GMT.
 *
 * The round trip matters: a Date built here, read back through local getters
 * (`getFullYear`/`getMonth`/`getDate`), yields the same calendar day whatever
 * the process zone is. That is what lets day-keyed code stay correct on a
 * UTC server.
 */
export function parseLocalYMD(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}
