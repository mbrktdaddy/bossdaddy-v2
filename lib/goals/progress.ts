// Derived progress — streaks, adherence, and where a goal actually stands.
//
// NOTHING HERE IS STORED. Streaks are computed from the log every time, because
// a stored streak is a number that can be wrong, and a wrong streak is worse
// than no streak: it either robs someone of a day they earned or credits one
// they didn't. Cache these if a page gets slow; never make them authoritative.
//
// The shapes are narrow structural types rather than generated DB rows so this
// module stays pure and testable.

export type EntryLike = {
  local_date: string
  kind: string           // 'completed' | 'skipped' | 'catchup' | 'relapse' | 'measurement'
  value: number | null
}

export type OccurrenceLike = {
  local_date: string
  status: string         // 'pending' | 'notified' | 'completed' | 'skipped' | 'missed' | 'snoozed'
  target_value: number | null
}

const DAY_MS = 86_400_000
const COUNTS_AS_DONE = new Set(['completed', 'catchup'])

/**
 * Consecutive days ending today (or yesterday) with a completed/catch-up entry.
 *
 * TODAY IS GRACE, NOT FAILURE. An unlogged today doesn't break the streak — it's
 * still in progress until the day ends. Counting from yesterday when today is
 * blank is the difference between "you're on day 12" and a tracker that tells a
 * dad he's back to zero every morning before breakfast.
 *
 * An explicit `skipped` DOES break it. He said not today, and pretending
 * otherwise makes the number meaningless.
 */
export function computeStreak(entries: EntryLike[], todayLocal: string): number {
  const byDate = new Map<string, string[]>()
  for (const entry of entries) {
    const kinds = byDate.get(entry.local_date) ?? []
    kinds.push(entry.kind)
    byDate.set(entry.local_date, kinds)
  }

  const start = ymdToMs(todayLocal)
  if (start == null) return 0

  // Anchor on today if it's resolved either way; otherwise start at yesterday.
  const todayKinds = byDate.get(todayLocal) ?? []
  let cursor = todayKinds.length > 0 ? start : start - DAY_MS

  let streak = 0
  // Bounded so a corrupt log can't spin: a decade is more than any real streak.
  for (let guard = 0; guard < 3700; guard++) {
    const kinds = byDate.get(msToYmd(cursor))
    if (!kinds || kinds.length === 0) break
    if (kinds.some((k) => COUNTS_AS_DONE.has(k))) streak++
    else break     // skipped / relapse-only day ends the run
    cursor -= DAY_MS
  }
  return streak
}

/**
 * Completion rate over the occurrences that have actually resolved. Pending and
 * snoozed rows are excluded — a day that hasn't happened yet is not a miss, and
 * counting it as one makes every new goal look like a failure on day one.
 */
export function adherenceRate(
  occurrences: OccurrenceLike[],
): { done: number; total: number; pct: number | null } {
  let done = 0
  let total = 0
  for (const occurrence of occurrences) {
    if (occurrence.status === 'pending' || occurrence.status === 'snoozed') continue
    total++
    if (occurrence.status === 'completed') done++
  }
  return { done, total, pct: total === 0 ? null : Math.round((done / total) * 100) }
}

/** The most recent measured value, for goals that measure something. */
export function latestValue(entries: EntryLike[]): { value: number; localDate: string } | null {
  let best: { value: number; localDate: string } | null = null
  for (const entry of entries) {
    if (entry.value == null) continue
    if (!best || entry.local_date > best.localDate) {
      best = { value: entry.value, localDate: entry.local_date }
    }
  }
  return best
}

/**
 * How far along the baseline → target journey the latest reading sits, 0–1.
 *
 * Direction-agnostic: cutting from 20 to 0 and gaining from 150 to 170 both read
 * as forward motion, because the fraction is measured along the span rather than
 * against an inequality. Clamped, so overshooting reads as done rather than 140%.
 */
export function progressToTarget(
  baseline: number | null,
  target: number | null,
  latest: number | null,
): number | null {
  if (baseline == null || target == null || latest == null) return null
  const span = target - baseline
  if (span === 0) return latest === target ? 1 : 0
  const travelled = (latest - baseline) / span
  return Math.max(0, Math.min(1, Math.round(travelled * 1000) / 1000))
}

/**
 * Did today's log beat, meet, or miss the day's target? Used for a calm one-line
 * verdict, never a red banner — see brand-guide §1.6.
 *
 * `direction` decides which side of the target is good: 'down' for a taper,
 * 'up' for a gain, 'hold' for staying put.
 */
export function compareToTarget(
  actual: number,
  target: number,
  direction: string | null,
): 'better' | 'met' | 'over' {
  if (actual === target) return 'met'
  if (direction === 'up') return actual > target ? 'better' : 'over'
  if (direction === 'hold') return 'over'
  return actual < target ? 'better' : 'over'   // 'down' and the default
}

function ymdToMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function msToYmd(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
