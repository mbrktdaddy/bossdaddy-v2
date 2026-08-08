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

/** Checkbox labels for the day picker. Shared by the create and edit forms. */
export const WEEKDAY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
]

/**
 * Timezone options. Deliberately a short list of common zones rather than all
 * ~400 from Intl.supportedValuesOf — a select nobody can scroll is worse than one
 * that covers the actual audience, and the detected zone is prepended when it
 * isn't already here.
 */
export const COMMON_ZONES: readonly string[] = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Toronto', 'America/Mexico_City', 'America/Sao_Paulo',
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
  'Africa/Johannesburg', 'Asia/Jerusalem', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Singapore', 'Asia/Tokyo', 'Australia/Perth', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
]

const WEEKDAY_SET = 'MO,TU,WE,TH,FR'

/**
 * The inverse of buildRrule: recovers the picker state from a stored rule so the
 * edit form can show what's actually set.
 *
 * A rule this function can't classify (hand-written, or a shape a future UI
 * emits) falls back to the closest editable approximation rather than throwing —
 * the edit form is not the right place to strand someone. Anything genuinely
 * exotic keeps working in the engine; it just can't be round-tripped through the
 * simplified picker without being rewritten.
 */
export function parseWhen(rrule: string): { when: WhenChoice; days: string[] } {
  const upper = rrule.toUpperCase()
  const freq = /(?:^|;)FREQ=([A-Z]+)/.exec(upper)?.[1]

  if (freq === 'MONTHLY') return { when: 'monthly', days: [] }

  const byDay = /(?:^|;)BYDAY=([A-Z,]+)/.exec(upper)?.[1]
  if (freq === 'WEEKLY' && byDay) {
    const days = normalizeDays(byDay.split(','))
    if (days.join(',') === WEEKDAY_SET) return { when: 'weekdays', days }
    return { when: 'days', days }
  }

  return { when: 'daily', days: [] }
}

/**
 * Human-readable schedule, e.g. "Mon, Wed, Fri at 6:30 AM".
 *
 * The detail page was rendering the raw RRULE at users, which is the schema
 * leaking through the interface. `localTime` is HH:MM or Postgres's HH:MM:SS.
 */
export function describeRrule(rrule: string, localTime?: string): string {
  const { when, days } = parseWhen(rrule)
  const at = localTime ? ` at ${formatTime(localTime)}` : ''

  switch (when) {
    case 'weekdays':
      return `Weekdays${at}`
    case 'monthly': {
      const dayOfMonth = /(?:^|;)BYMONTHDAY=(-?\d+)/i.exec(rrule)?.[1]
      return dayOfMonth ? `Monthly on the ${ordinal(Number(dayOfMonth))}${at}` : `Monthly${at}`
    }
    case 'days': {
      const labels = days
        .map((d) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label ?? d)
      if (labels.length === 1) return `Every ${labels[0]}${at}`
      return `${labels.join(', ')}${at}`
    }
    default: {
      const interval = /(?:^|;)INTERVAL=(\d+)/i.exec(rrule)?.[1]
      if (interval && interval !== '1') return `Every ${interval} days${at}`
      return `Every day${at}`
    }
  }
}

function formatTime(localTime: string): string {
  const [hh, mm] = localTime.split(':')
  const hour = Number(hh)
  if (!Number.isFinite(hour)) return localTime
  const suffix = hour < 12 ? 'AM' : 'PM'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${mm ?? '00'} ${suffix}`
}

function ordinal(n: number): string {
  if (n < 0) return `${Math.abs(n)}${Math.abs(n) === 1 ? 'st' : 'th'}-to-last`
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

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
