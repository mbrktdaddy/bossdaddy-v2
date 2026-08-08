// Target curves — the per-occurrence number a goal is asking for on a given day.
//
// This is what separates a goal tracker from a checkbox grid. A taper isn't
// "quit smoking", it's 20/day this week, 18 next, 16 the week after. A training
// program isn't "work out", it's a prescription that moves. So the curve is
// evaluated at materialization time and STAMPED onto each occurrence
// (`goal_occurrences.target_value`) rather than recomputed at read time — the
// number a dad was asked for on March 3rd must not change retroactively because
// he later moved his target date.
//
// Progress is then actual-vs-this-number, which is why a taper can show honest
// forward motion on a day he still smoked six.

/** The curve-bearing subset of a `goals` row. Narrow on purpose — testable. */
export type CurveInput = {
  curve: string                       // 'none' | 'linear' | 'step'
  baseline_value: number | null
  target_value: number | null
  started_on: string                  // YYYY-MM-DD
  target_date: string | null          // YYYY-MM-DD
  step_every_days: number | null
}

const DAY_MS = 86_400_000

/**
 * The target for the occurrence falling on `localDate` (YYYY-MM-DD, the user's
 * calendar date — not a UTC date).
 *
 * Returns null when the goal carries no target at all (pure adherence: "took the
 * vitamin" has nothing to measure).
 *
 * FAIL-SOFT RULE: a curve that can't be interpolated (no target_date, a
 * nonsensical span, a missing endpoint) falls back to `baseline_value` — the
 * EASIEST target — never to `target_value`. Getting this backwards would tell a
 * dad on day one of an eight-week taper that today's allowance is zero, which is
 * both wrong and the kind of thing that makes someone delete the app.
 */
export function targetForDate(goal: CurveInput, localDate: string): number | null {
  const { curve, baseline_value: baseline, target_value: target } = goal

  if (curve === 'none') return target ?? baseline ?? null
  if (baseline == null || target == null) return baseline ?? target ?? null

  const elapsed = daysBetween(goal.started_on, localDate)
  if (elapsed == null) return baseline
  if (elapsed <= 0) return baseline

  const span = goal.target_date == null ? null : daysBetween(goal.started_on, goal.target_date)
  if (span == null || span <= 0) return baseline
  if (elapsed >= span) return target

  if (curve === 'linear') {
    return round3(baseline + ((target - baseline) * elapsed) / span)
  }

  if (curve === 'step') {
    const stepDays = goal.step_every_days
    if (stepDays == null || stepDays <= 0) return baseline
    // Steps land on completed intervals: with stepDays=7, days 0-6 hold the
    // baseline, day 7 takes the first step down. The final step lands ON
    // target_date, so a 56-day / 7-day taper is 8 steps, not 7.
    const totalSteps = Math.floor(span / stepDays)
    if (totalSteps <= 0) return baseline
    const takenSteps = Math.min(Math.floor(elapsed / stepDays), totalSteps)
    return round3(baseline + ((target - baseline) * takenSteps) / totalSteps)
  }

  // Unknown curve value — treat as flat rather than guessing.
  return target
}

/**
 * Whole days from `fromYmd` to `toYmd`, or null if either date is malformed.
 * Both are calendar dates, so this is pure date arithmetic with no timezone
 * involved: parsing them as UTC midnight cancels out in the subtraction.
 */
export function daysBetween(fromYmd: string, toYmd: string): number | null {
  const a = ymdToUtcMs(fromYmd)
  const b = ymdToUtcMs(toYmd)
  if (a == null || b == null) return null
  return Math.round((b - a) / DAY_MS)
}

function ymdToUtcMs(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(ms) ? null : ms
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
