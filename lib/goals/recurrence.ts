// Recurrence engine for the goals spine — the ONE file allowed to import a
// recurrence library. Everything else (cron materializer, Server Actions, the
// Boss's goal tools) talks to this module in plain `Date`s and `YYYY-MM-DD`
// strings. Swapping the engine stays a one-file change.
//
// WHY THIS WRAPPER EXISTS
// -----------------------
// We shipped `rrule@2.8.1` first and reverted it. Its `dateInTimeZone()` helper
// converts by subtracting "target zone minus THE PROCESS's zone":
//
//     var localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
//
// So `tzid` is only correct when the process itself runs in UTC. A 6:30 am
// America/New_York rule produced 10:30Z under `TZ=UTC` (right) and 05:30Z on a
// developer box in America/Chicago (wrong) — and worse, the local wall clock
// drifted 01:30 → 00:30 across the Nov 1 2026 DST boundary instead of holding.
// That also means DST unit tests written on a non-UTC machine assert the wrong
// numbers, so the bug hides from its own test.
//
// `rrule-temporal` resolves wall clock → instant through Temporal, which reads
// the IANA database directly and never consults the process zone. Verified
// byte-identical output under `America/Chicago` and `TZ=UTC`.
//
// DST AMBIGUITY POLICY (fixed by the library, RFC 5545 semantics)
// --------------------------------------------------------------
//   Fall-back overlap (01:30 happens twice) → the EARLIER reading. One nudge.
//   Spring-forward gap (02:30 doesn't exist) → shifts FORWARD (02:30 → 03:30).
//
// It is not configurable, and both defaults are the right ones for reminders.
// When a gap shifts an occurrence we surface it as `shifted: true` so the UI
// can say "3:30 am today, clocks changed" instead of silently lying.
//
// UPSTREAM DEFECT WE CORRECT HERE (rrule-temporal@2.0.2)
// -----------------------------------------------------
// A gap shift STICKS to every later occurrence on the DAILY, MONTHLY, and
// YEARLY paths — the engine holds the UTC instant and lets the wall clock
// drift, instead of the reverse. A 02:30 America/New_York daily rule:
//
//     Mar  7 2026 → 07:30Z  02:30 local   ✓
//     Mar  8 2026 → 07:30Z  03:30 local   ✓ gap day, shifted forward
//     Mar  9 2026 → 07:30Z  03:30 local   ✗ should be 06:30Z / 02:30 local
//     Mar 10 2026 → 07:30Z  03:30 local   ✗ …and forever after
//
// MONTHLY and YEARLY drift the same way (2027-03-08 came back 08:30Z @ 03:30).
// WEEKLY recovers correctly, and a wall time that never lands in a gap is
// unaffected. Left alone, a dad's 2:30 am pill reminder is permanently an hour
// late after the second Sunday in March, silently.
//
// The correction: any occurrence whose resolved wall clock differs from the
// requested one is re-anchored by asking the engine to resolve the requested
// wall clock on that occurrence's OWN local date — a single-shot resolution,
// which is the path that behaves correctly. A true gap day re-resolves to the
// same shifted time (so it stays `shifted: true`); every day after it snaps
// back. No hand-rolled timezone arithmetic, and the fix costs nothing on
// schedules that never touch a gap.

import { RRuleTemporal } from 'rrule-temporal'
import { localDateInZone as localDateInZoneUnchecked } from '@/lib/dates'

/** A schedule as stored in `goal_schedules`. Local wall clock + IANA zone. */
export type GoalSchedule = {
  /** RRULE body with no `RRULE:` prefix, e.g. `FREQ=WEEKLY;BYDAY=MO,WE,FR`. */
  rrule: string
  /** `YYYY-MM-DD` — the first local calendar date the rule applies from. */
  startDate: string
  /** `HH:MM` — local wall clock. NOT a UTC hour. Never store a UTC hour. */
  localTime: string
  /** IANA zone, e.g. `America/New_York`. */
  timezone: string
}

/** One materialized instance, ready to become a `goal_occurrences` row. */
export type Occurrence = {
  /** True UTC instant — this is what `goal_occurrences.due_at` stores. */
  dueAt: Date
  /** Local calendar date in the schedule's zone — what streaks key on. */
  localDate: string
  /** Local wall clock actually resolved. Differs from the request on a gap. */
  localTime: string
  /** True when a spring-forward gap moved this occurrence off its wall time. */
  shifted: boolean
}

export class RecurrenceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecurrenceError'
  }
}

// A reminder product has no use for sub-daily recurrence, and `FREQ=MINUTELY`
// over a 60-day materialization window is ~86k rows per schedule — a cron
// self-DoS one malformed rule away. Allowlist the frequencies we support.
const ALLOWED_FREQ = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])

/** Hard cap on what one expansion call can return, whatever the rule says. */
export const MAX_OCCURRENCES = 512

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/
const HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Validates a schedule and throws `RecurrenceError` with a specific reason.
 * Call this at the API/Server Action edge before persisting a schedule — a bad
 * rule should fail on the user's screen, not silently in a 4 a.m. cron.
 */
export function assertValidSchedule(schedule: GoalSchedule): void {
  const { rrule, startDate, localTime, timezone } = schedule

  if (!YMD_RE.test(startDate)) {
    throw new RecurrenceError(`startDate must be YYYY-MM-DD, got "${startDate}"`)
  }
  if (!HM_RE.test(localTime)) {
    throw new RecurrenceError(`localTime must be HH:MM (00:00–23:59), got "${localTime}"`)
  }
  if (!isValidTimeZone(timezone)) {
    throw new RecurrenceError(`unknown IANA time zone "${timezone}"`)
  }

  // Newlines would let a stored rule inject extra ICS properties (a second
  // DTSTART, an EXDATE) into the string we hand the parser.
  if (/[\r\n]/.test(rrule)) {
    throw new RecurrenceError('rrule must be a single line')
  }
  if (/DTSTART/i.test(rrule)) {
    throw new RecurrenceError('rrule must not carry its own DTSTART — use startDate + localTime')
  }

  const freq = /(?:^|;)FREQ=([A-Z]+)/i.exec(rrule)?.[1]?.toUpperCase()
  if (!freq) throw new RecurrenceError('rrule must include FREQ=')
  if (!ALLOWED_FREQ.has(freq)) {
    throw new RecurrenceError(
      `FREQ=${freq} is not supported — use ${[...ALLOWED_FREQ].join(', ')}`,
    )
  }

  // Cheapest real proof the rule parses: build it. Bad BYDAY tokens, malformed
  // INTERVAL, etc. surface here rather than at materialization time.
  try {
    buildRule(schedule)
  } catch (err) {
    throw new RecurrenceError(
      `rrule failed to parse: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Expands a schedule into occurrences whose `dueAt` falls in `[from, to]`.
 * Both bounds are real UTC instants — pass `new Date()` and `now + 60 days`
 * from the materializer and store what comes back.
 */
export function expandOccurrences(
  schedule: GoalSchedule,
  from: Date,
  to: Date,
): Occurrence[] {
  if (!(from instanceof Date) || Number.isNaN(from.getTime())) {
    throw new RecurrenceError('from must be a valid Date')
  }
  if (!(to instanceof Date) || Number.isNaN(to.getTime())) {
    throw new RecurrenceError('to must be a valid Date')
  }
  if (to.getTime() < from.getTime()) {
    throw new RecurrenceError('to must not be before from')
  }

  const rule = buildRule(schedule)
  return rule
    .between(from, to, true)
    .slice(0, MAX_OCCURRENCES)
    .map((zdt) => resolveOccurrence(zdt, schedule))
}

/** The next occurrence strictly after `after`, or null if the rule is spent. */
export function nextOccurrence(schedule: GoalSchedule, after: Date): Occurrence | null {
  const zdt = buildRule(schedule).next(after, false)
  return zdt ? resolveOccurrence(zdt, schedule) : null
}

/**
 * The two ICS content lines this schedule represents. `.ics` export builds a
 * VEVENT around these — the same string the engine itself parses, so the
 * calendar a dad subscribes to can't drift from the nudges he gets.
 *
 * `allDay` emits a DATE-valued DTSTART instead of a zoned DATE-TIME, which is
 * what turns a block on the grid into a chip in the all-day strip. See
 * CalendarEvent.allDay in lib/goals/ics.ts for why that's the default.
 *
 * `until` (YYYY-MM-DD) BOUNDS THE RECURRENCE, and its absence was a real defect:
 * the stored rrule is bare (`FREQ=DAILY`), so every goal recurred to infinity and
 * an eight-week taper kept filling the calendar months after it ended. Nothing
 * ever left. Pass the goal's target_date.
 */
export function icsRuleLines(
  schedule: GoalSchedule,
  opts: { allDay?: boolean; until?: string | null } = {},
): [string, string] {
  assertValidSchedule(schedule)

  // RFC 5545 §3.3.10: UNTIL must match DTSTART's value type. A DATE-valued start
  // takes a DATE; a zoned DATE-TIME start takes a UTC DATE-TIME. Getting this
  // wrong is the kind of thing one client ignores and the next one chokes on.
  const untilPart = (() => {
    if (!opts.until || !YMD_RE.test(opts.until)) return ''
    // Never append to a rule that already terminates — doubling UNTIL, or adding
    // one alongside a COUNT, is invalid.
    if (/(^|;)(UNTIL|COUNT)=/i.test(schedule.rrule)) return ''
    const compact = opts.until.replace(/-/g, '')
    return opts.allDay ? `;UNTIL=${compact}` : `;UNTIL=${compact}T235959Z`
  })()

  const dtstart = opts.allDay
    // No TZID on a DATE value — all-day events are floating by definition, which
    // is correct here: the date came from the schedule's own zone already.
    ? `DTSTART;VALUE=DATE:${schedule.startDate.replace(/-/g, '')}`
    : `DTSTART;TZID=${schedule.timezone}:${icsBasicLocal(schedule)}`

  return [dtstart, `RRULE:${schedule.rrule}${untilPart}`]
}

/**
 * The local calendar date (`YYYY-MM-DD`) of an instant in a given zone.
 *
 * Entries key on this, never on a UTC date: a dad who logs at 11 pm Central is
 * on tomorrow's UTC date, and keying by UTC silently breaks his streak the
 * moment he travels. Offline clients compute their own local date at log time
 * and send it — do not re-derive it at sync time.
 *
 * The formatting itself now lives in `lib/dates.ts`, which is dependency-free
 * so client bundles can use it without pulling `rrule-temporal` in through this
 * module. This wrapper keeps the RecurrenceError contract the goals code and
 * its tests rely on.
 */
export function localDateInZone(instant: Date, timezone: string): string {
  if (!isValidTimeZone(timezone)) {
    throw new RecurrenceError(`unknown IANA time zone "${timezone}"`)
  }
  return localDateInZoneUnchecked(instant, timezone)
}

export function isValidTimeZone(timezone: string): boolean {
  if (!timezone || typeof timezone !== 'string') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

// ── internals ───────────────────────────────────────────────────────────────

/** `20261029T063000` — ICS basic-format LOCAL wall clock, no Z suffix. */
function icsBasicLocal(schedule: GoalSchedule): string {
  return `${schedule.startDate.replace(/-/g, '')}T${schedule.localTime.replace(':', '')}00`
}

function buildRule(schedule: GoalSchedule): RRuleTemporal {
  const { rrule, startDate, localTime, timezone } = schedule
  return new RRuleTemporal({
    rruleString: `RRULE:${rrule}`,
    // The library accepts a structural `{ timeZoneId, toString() }`, so no
    // Temporal object — and therefore no polyfill — enters this codebase.
    dtstart: {
      timeZoneId: timezone,
      toString: () => `${startDate}T${localTime}:00[${timezone}]`,
    },
    tzid: timezone,
  })
}

type ZonedFields = {
  epochMilliseconds: number
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/**
 * Converts one engine result into an `Occurrence`, correcting the sticky
 * gap-shift defect documented at the top of this file.
 */
function resolveOccurrence(zdt: ZonedFields, schedule: GoalSchedule): Occurrence {
  const occurrence = toOccurrence(zdt, schedule)
  if (!occurrence.shifted) return occurrence

  // Ask the engine to resolve the REQUESTED wall clock on this occurrence's own
  // local date. Single-shot resolution doesn't carry the drift.
  const [reanchored] = buildRule({
    ...schedule,
    rrule: 'FREQ=DAILY;COUNT=1',
    startDate: occurrence.localDate,
  }).all()
  if (!reanchored) return occurrence

  const candidate = toOccurrence(reanchored, schedule)
  // On a genuine gap day the re-resolution shifts forward too — that IS the
  // right answer, so we keep it and `shifted` stays true. The date must match;
  // if it somehow didn't, prefer the engine's original result.
  return candidate.localDate === occurrence.localDate ? candidate : occurrence
}

function toOccurrence(zdt: ZonedFields, schedule: GoalSchedule): Occurrence {
  const localTime = `${pad(zdt.hour)}:${pad(zdt.minute)}`
  return {
    dueAt: new Date(Number(zdt.epochMilliseconds)),
    localDate: `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}`,
    localTime,
    // A spring-forward gap is the only thing that moves an occurrence off its
    // requested wall clock, so an inequality here IS the gap detector.
    shifted: localTime !== schedule.localTime,
  }
}
