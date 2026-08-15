// The shapes behind the history grid and the metric trend — pure, so the two
// visual surfaces on the goal page can be tested without a browser or a database.
//
// ─────────────────────────────────────────────────────────────────────────────
// ONE CLASSIFICATION, SHARED WITH THE STREAK
//
// `buildHistoryGrid` does not re-derive whether a day was kept. It calls
// `classifyScheduledDays` (lib/goals/progress.ts) — the same function the streak
// and the best run walk — and only ADDS detail inside the states that function
// collapses. So the grid can disagree with the number above it about presentation,
// never about facts. Re-implementing "was this day kept?" here is how a heat map
// ends up showing twelve green cells beside a streak of three.
//
// Two states exist here that the streak deliberately has no opinion about:
//
//   extra    a log on a day nothing was scheduled. It's a vote and it counts in
//            kept_total, but it does NOT extend the chain, so the grid marks it
//            differently rather than pretending it was a scheduled day. Same
//            distinction the Log list draws with its "Extra" marker.
//   none     no occurrence, no entry. A Tuesday on a MO/WE/FR plan is not a gap
//            in anything — it was never asked for.
//
// `broken` from the streak's walk is split into `skipped` (he answered "not
// today") and `missed` (the day lapsed unanswered). Both end a run identically;
// they are very different things to look back at.
// ─────────────────────────────────────────────────────────────────────────────

import {
  classifyScheduledDays, shiftLocalDate,
  type EntryLike, type OccurrenceLike,
} from '@/lib/goals/progress'

export type CellState = 'kept' | 'extra' | 'skipped' | 'missed' | 'open' | 'none'

export type HistoryCell = {
  /** YYYY-MM-DD, the local date this cell counts for. */
  date: string
  state: CellState
  /** The value logged that day, when the goal measures something. */
  value: number | null
  /** The target stamped on that day's occurrence — history, not a recomputation. */
  target: number | null
}

/** Occurrence shape the grid needs: `classifyScheduledDays`' plus the day's target. */
type OccurrenceWithTarget = OccurrenceLike

/**
 * One cell per calendar date in `[fromYmd, toYmd]`, inclusive.
 *
 * The window is the caller's business — the component asks for whole weeks so the
 * grid is rectangular, and nothing here assumes that.
 */
export function buildHistoryGrid(args: {
  occurrences: OccurrenceWithTarget[]
  entries: EntryLike[]
  fromYmd: string
  toYmd: string
}): HistoryCell[] {
  const { occurrences, entries, fromYmd, toYmd } = args

  const classified = new Map(
    classifyScheduledDays(occurrences, entries).map((day) => [day.date, day.state]),
  )

  // What the log says happened, by date. `skipped` is tracked separately from a
  // vote because it's the difference between the two ways a run can end.
  const skippedDates = new Set<string>()
  const loggedDates = new Set<string>()
  const valueByDate = new Map<string, number>()
  for (const entry of entries) {
    if (entry.kind === 'skipped') skippedDates.add(entry.local_date)
    else loggedDates.add(entry.local_date)
    // Last value wins for a date with several; the Log lists them all anyway.
    if (entry.value != null) valueByDate.set(entry.local_date, entry.value)
  }

  const skippedOccurrenceDates = new Set(
    occurrences.filter((o) => o.status === 'skipped').map((o) => o.local_date),
  )
  const targetByDate = new Map<string, number>()
  for (const occurrence of occurrences) {
    if (occurrence.target_value != null) {
      targetByDate.set(occurrence.local_date, occurrence.target_value)
    }
  }

  const cells: HistoryCell[] = []
  let cursor: string | null = fromYmd
  // Bounded so a malformed window can't spin. Two years of daily cells is far more
  // than any grid renders.
  for (let guard = 0; cursor != null && cursor <= toYmd && guard < 800; guard++) {
    cells.push({
      date: cursor,
      state: stateFor(cursor),
      value: valueByDate.get(cursor) ?? null,
      target: targetByDate.get(cursor) ?? null,
    })
    cursor = shiftLocalDate(cursor, 1)
  }
  return cells

  function stateFor(date: string): CellState {
    const scheduled = classified.get(date)
    if (scheduled === 'kept') return 'kept'
    if (scheduled === 'open') return 'open'
    if (scheduled === 'broken') {
      return skippedDates.has(date) || skippedOccurrenceDates.has(date)
        ? 'skipped'
        : 'missed'
    }
    // Nothing was scheduled — every date that owns an occurrence was classified
    // above, so there is no fourth scheduled state to fall through to. A log on a
    // day nothing was due is an extra; a bare skip entry with no occurrence behind
    // it is still him answering, so it reads as skipped.
    if (loggedDates.has(date)) return 'extra'
    if (skippedDates.has(date)) return 'skipped'
    return 'none'
  }
}

/**
 * Which day a displayed week begins on. 0 = Sunday, 1 = Monday.
 *
 * Sunday, because that's what a wall calendar in this audience's kitchen does, and a
 * history grid that disagrees with every other calendar someone owns costs them a
 * beat on every glance.
 *
 * ⚠️ THIS IS A DISPLAY KNOB AND HAS NOTHING TO DO WITH RECURRENCE. `DAY_TOKENS` in
 * lib/goals/schedule-input.ts stays Monday-first because RFC 5545 defaults to
 * WKST=MO, and WKST is load-bearing semantics — it decides which days an
 * INTERVAL>1 weekly rule groups into "a week", so changing it to match this would
 * silently move people's reminders. Two different questions that happen to both
 * involve weeks. Don't reconcile them.
 */
export const WEEK_STARTS_ON: 0 | 1 = 0

/**
 * Column headers, in the same order the grid lays cells out.
 *
 * Exported so the header and the cells cannot drift: they were duplicated in two
 * components, and a header that disagrees with its columns is a bug that looks like
 * data (already hit once, when the initials implied the opposite axis).
 */
export const WEEKDAY_INITIALS: readonly string[] =
  WEEK_STARTS_ON === 0
    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
    : ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * Position of a date within its displayed week: 0 = the first column … 6 = the last.
 * Null if malformed. Respects WEEK_STARTS_ON.
 */
export function weekdayIndex(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  return (day - WEEK_STARTS_ON + 7) % 7    // JS puts Sunday at 0
}

/** The first day of the displayed week containing `ymd`. */
export function weekStart(ymd: string): string | null {
  const index = weekdayIndex(ymd)
  return index == null ? null : shiftLocalDate(ymd, -index)
}

/**
 * A rectangular window of `weeks` whole weeks, ending with the week that contains
 * `todayLocal`. Returns null on a malformed date rather than a lopsided grid.
 */
export function gridWindow(todayLocal: string, weeks: number): { from: string; to: string } | null {
  const thisWeek = weekStart(todayLocal)
  if (thisWeek == null) return null
  const from = shiftLocalDate(thisWeek, -7 * (weeks - 1))
  const to = shiftLocalDate(thisWeek, 6)
  return from == null || to == null ? null : { from, to }
}

// ⚠️ THERE IS NO CHAIN HELPER HERE, AND THAT IS A DECISION — DON'T ADD ONE BACK.
//
// A `withChainFlags()` existed to draw a run of kept days as one joined bar, the way
// the reference habit trackers do. Two renderings of it were both reported as
// rendering bugs by the operator: the first reshaped the chained cell (a negative
// margin plus a squared corner), which grew its box and pushed the day number
// off-axis from every other column; the second kept cells uniform and laid a
// connector across the gutter, which fused two tiles into a lumpy block while an
// adjacent skipped→logged pair stayed separate, so the silhouette read as a defect.
//
// Adjacent fills already communicate a run, and the authoritative number is the
// "running" stat directly above the calendar. See brand-guide §2, "State is encoded
// with colour, never with geometry".

// ── months ──────────────────────────────────────────────────────────────────
//
// The history grid started as twelve weeks, and for a goal a fortnight old that is
// 84 cells of which five say anything — a mosaic of eighty grey tiles twelve rows
// tall, which reads as noise and costs more screen than the information in it. A
// month is the frame people already have for "which days did I do this", it halves
// the height, and it still runs weekday-across so the chain works.

/** `YYYY-MM` of a `YYYY-MM-DD`, or null if malformed. */
export function monthOf(ymd: string): string | null {
  return /^(\d{4})-(\d{2})-\d{2}$/.test(ymd) ? ymd.slice(0, 7) : null
}

/** Shifts a `YYYY-MM` by whole months. Pure string arithmetic — no Date, no zone. */
export function addMonths(month: string, delta: number): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month)
  if (!m) return null
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta
  if (total < 0) return null
  const year = Math.floor(total / 12)
  return `${String(year).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`
}

/**
 * The window a month calendar needs: whole weeks covering every day of
 * `month`, so the grid is rectangular and the leading/trailing days belong to the
 * neighbouring months. The renderer greys those out; it does NOT drop them, because
 * a calendar with a ragged first row stops reading as a calendar.
 */
export function monthGridWindow(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null
  const first = `${month}-01`
  const nextMonth = addMonths(month, 1)
  if (!nextMonth) return null
  const lastDay = shiftLocalDate(`${nextMonth}-01`, -1)
  if (!lastDay) return null

  const from = weekStart(first)
  const lastWeekStart = weekStart(lastDay)
  const to = lastWeekStart == null ? null : shiftLocalDate(lastWeekStart, 6)
  return from == null || to == null ? null : { from, to }
}

/** Counts per state, for the grid's text summary — the accessible twin of colour. */
export function summarizeGrid(cells: HistoryCell[]): Record<CellState, number> {
  const out: Record<CellState, number> = {
    kept: 0, extra: 0, skipped: 0, missed: 0, open: 0, none: 0,
  }
  for (const cell of cells) out[cell.state]++
  return out
}

// ── the metric trend ────────────────────────────────────────────────────────

export type TrendPoint = {
  date: string
  /** What he logged. Null on a day with a target and no reading. */
  value: number | null
  /** What the plan asked for, as STAMPED on the occurrence at materialization. */
  target: number | null
}

/**
 * Points for the plan-vs-actual line, oldest first.
 *
 * Only dates carrying a value or a target — a weekly weigh-in must not become
 * eighty-three empty days with one dot. Both series share one measure and
 * therefore ONE axis; a second scale here would invent a correlation.
 */
export function buildTrendSeries(cells: HistoryCell[]): TrendPoint[] {
  return cells
    .filter((cell) => cell.value != null || cell.target != null)
    .map((cell) => ({ date: cell.date, value: cell.value, target: cell.target }))
}

/** Min and max across both series, or null when there's nothing to plot. */
export function trendExtent(points: TrendPoint[]): { min: number; max: number } | null {
  const numbers: number[] = []
  for (const point of points) {
    if (point.value != null) numbers.push(point.value)
    if (point.target != null) numbers.push(point.target)
  }
  if (!numbers.length) return null
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  // A flat series would divide by zero when scaled; give it a band to sit in.
  return min === max ? { min: min - 1, max: max + 1 } : { min, max }
}
