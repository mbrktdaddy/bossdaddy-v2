// Pure math + types for the Savings tool. No client/server context — safe
// in both. Mirrors the architectural posture of lib/dad-tools/calc.ts and
// lib/dad-tools/dad-math.ts.
//
// The streak engine. Two ideas to keep straight:
//
//   1. RUNNING TOTAL is the sum of all contribution + catchup amounts.
//      Skips don't add anything. This is what "$184 saved" means.
//
//   2. STREAK + BANKED DAYS are cadence-aware. A cadence-unit (day, ISO week,
//      or calendar month) is "covered" if the contributions assigned to that
//      unit, plus any carryover from prior units, meet the cadence amount.
//      Surplus carries forward as a bank. A unit that can't be covered breaks
//      the streak and resets the bank — but partial contributions made within
//      that unit still survive as carryover starting bank for the next unit.
//
// Free-form goals (cadence is null) have no streak / no banked days. Only
// runningTotal + history matter.

import { futureValue } from './dad-math'

// ── Types ───────────────────────────────────────────────────────────────────

export type SavingsCadence = 'daily' | 'weekly' | 'monthly'
export type SavingsEntryKind =
  | 'contribution'
  | 'skip'
  | 'catchup'
  | 'withdrawal'
  | 'adjustment_credit'
  | 'adjustment_debit'
export type SavingsGoalStatus = 'active' | 'paused' | 'completed' | 'archived'
export type DestinationMode = 'shared' | 'per_participant' | 'manual'
export type DestinationType = 'paypal' | 'venmo' | 'cashapp' | 'zelle' | 'manual'

export interface SavingsGoal {
  id:                  string
  owner_id:            string
  kid_profile_id:      string | null
  name:                string
  description:         string | null
  cadence:             SavingsCadence | null
  amount_per_cadence:  number | null
  start_date:          string  // YYYY-MM-DD
  target_amount:       number | null
  target_date:         string | null
  destination_mode:    DestinationMode
  destination_url:     string | null
  destination_type:    DestinationType | null
  destination_label:   string | null
  reminder_enabled:    boolean
  reminder_cadence:    'daily' | 'weekly' | 'monthly' | 'off' | null
  reminder_hour_utc:   number | null
  status:              SavingsGoalStatus
  completed_at:        string | null
  archived_at:         string | null
  created_at:          string
  updated_at:          string
}

export interface SavingsEntry {
  id:              string
  goal_id:         string
  contributor_id:  string
  contributed_on:  string  // YYYY-MM-DD
  amount:          number
  kind:            SavingsEntryKind
  note:            string | null
  created_at:      string
}

export interface SavingsParticipant {
  id:                string
  goal_id:           string
  user_id:           string
  role:              'owner' | 'contributor'
  destination_url:   string | null
  destination_type:  DestinationType | null
  destination_label: string | null
  muted:             boolean
  joined_at:         string
}

export interface GoalStats {
  runningTotal:       number  // net of withdrawals
  totalContributed:   number  // gross contributions + catchups, ignoring withdrawals
  totalWithdrawn:     number  // sum of withdrawal amounts
  daysContributed:    number  // distinct dates with contribution+catchup entries
  daysSkipped:        number
  lastEntryAt:        string | null  // ISO timestamp
  streak:             number | null  // null for free-form goals; withdrawals don't break it
  bankedUnits:        number | null  // null for free-form goals
  aheadByUnits:       number | null  // positive ahead, negative behind, null for free-form
  expectedTotal:      number | null  // expected total at asOf based on cadence
  isComplete:         boolean
  projectedAtTarget:  number | null  // value at target_date if cadence set
  catchUpSuggestion:  CatchUpSuggestion | null
}

// Suggestion shown when a goal is behind plan. Symmetric mode (the only one
// we ship in v1.2): catch up over the same number of cadence-units that the
// deficit represents, doubling the per-unit contribution during that window.
//
// Example: $2/day goal, $100 withdrawal → 50-unit deficit → suggest
// "Contribute $4/day for 50 days to catch up by [today + 50 days]."
export interface CatchUpSuggestion {
  shortfall:        number    // dollars behind plan (always positive)
  shortfallUnits:   number    // shortfall / amount_per_cadence, rounded up
  extraPerUnit:     number    // additional dollars per cadence-unit during catch-up
  totalPerUnit:     number    // amount_per_cadence + extraPerUnit
  unitsToCatchUp:   number    // how many cadence-units to apply the bump
  catchUpUntilDate: string    // YYYY-MM-DD when caught up if plan is followed
}

// ── Cadence unit helpers ────────────────────────────────────────────────────
// All cadence-unit keys are lexicographically ordered strings so a < b means
// "a is earlier than b" without needing date parsing on every comparison.
//
//   daily   → 'YYYY-MM-DD'
//   weekly  → 'YYYY-Www' (ISO 8601 week)
//   monthly → 'YYYY-MM'

const MS_PER_DAY = 86_400_000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function parseYMD(ymd: string): Date {
  // YYYY-MM-DD parsed as local-time midnight (avoids the UTC drift that
  // `new Date('YYYY-MM-DD')` gives on V8).
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// ISO 8601 week: weeks start on Monday, week 1 contains the first Thursday.
function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((dt.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7)
  return `${dt.getUTCFullYear()}-W${pad2(weekNum)}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function unitKey(cadence: SavingsCadence, ymd: string): string {
  const d = parseYMD(ymd)
  switch (cadence) {
    case 'daily':   return dateToYMD(d)
    case 'weekly':  return isoWeekKey(d)
    case 'monthly': return monthKey(d)
  }
}

export function todayUnitKey(cadence: SavingsCadence, now: Date = new Date()): string {
  const ymd = dateToYMD(now)
  return unitKey(cadence, ymd)
}

// Count cadence-units elapsed from start to asOf, inclusive of both ends.
// (Day 1 = 1 unit; same week = 1 unit; same month = 1 unit.)
function unitsElapsed(cadence: SavingsCadence, start: string, asOf: Date): number {
  const startDate = parseYMD(start)
  const asOfDate = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  if (asOfDate < startDate) return 0
  switch (cadence) {
    case 'daily': {
      const diff = Math.floor((asOfDate.getTime() - startDate.getTime()) / MS_PER_DAY)
      return diff + 1
    }
    case 'weekly': {
      // Count distinct ISO weeks from start to asOf, walking week-by-week.
      let count = 0
      const cursor = new Date(startDate)
      const seen = new Set<string>()
      while (cursor <= asOfDate) {
        seen.add(isoWeekKey(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      count = seen.size
      return count
    }
    case 'monthly': {
      const months = (asOfDate.getFullYear() - startDate.getFullYear()) * 12
        + (asOfDate.getMonth() - startDate.getMonth())
      return months + 1
    }
  }
}

// Walk cadence-units forward from startKey through endKey (inclusive). Used
// by the streak engine. Bounded — caller must ensure end >= start.
function* iterateUnits(
  cadence: SavingsCadence,
  startYmd: string,
  endDate: Date,
): Generator<string> {
  const start = parseYMD(startYmd)
  const cursor = new Date(start)
  if (cadence === 'daily') {
    while (cursor <= endDate) {
      yield dateToYMD(cursor)
      cursor.setDate(cursor.getDate() + 1)
    }
    return
  }
  if (cadence === 'weekly') {
    const seen = new Set<string>()
    while (cursor <= endDate) {
      const key = isoWeekKey(cursor)
      if (!seen.has(key)) {
        seen.add(key)
        yield key
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return
  }
  // monthly
  const endY = endDate.getFullYear()
  const endM = endDate.getMonth()
  let y = cursor.getFullYear()
  let m = cursor.getMonth()
  while (y < endY || (y === endY && m <= endM)) {
    yield `${y}-${pad2(m + 1)}`
    m += 1
    if (m > 11) { m = 0; y += 1 }
  }
}

// ── Core statistics ─────────────────────────────────────────────────────────

// Net total: contributions + catchups + adjustment_credits MINUS withdrawals
// and adjustment_debits. Skips contribute 0.
export function runningTotal(entries: SavingsEntry[]): number {
  let total = 0
  for (const e of entries) {
    const amt = Number(e.amount) || 0
    switch (e.kind) {
      case 'contribution':
      case 'catchup':
      case 'adjustment_credit':
        total += amt
        break
      case 'withdrawal':
      case 'adjustment_debit':
        total -= amt
        break
      case 'skip':
      default:
        break
    }
  }
  return total
}

// Gross deposits, ignoring withdrawals. Used for the "you saved $X then took
// $Y back out" breakdown.
function sumByKind(entries: SavingsEntry[], kinds: SavingsEntryKind[]): number {
  let total = 0
  for (const e of entries) {
    if (kinds.includes(e.kind)) total += Number(e.amount) || 0
  }
  return total
}

// Expected total through COMPLETED cadence-units as of `asOf`. The current
// cadence-unit is in-progress and doesn't count yet — otherwise day 1 of a
// $2/day goal would surface as "behind by 1 day" before the user has even
// had the chance to make today's contribution.
//
// Examples:
//   day 1 (start = today) → 0 completed days → expected = $0
//   day 2                  → 1 completed day  → expected = $2
//   day 5                  → 4 completed days → expected = $8
export function expectedTotalAsOf(
  goal: Pick<SavingsGoal, 'cadence' | 'amount_per_cadence' | 'start_date'>,
  asOf: Date = new Date(),
): number | null {
  if (!goal.cadence || goal.amount_per_cadence == null) return null
  const elapsed = unitsElapsed(goal.cadence, goal.start_date, asOf)
  const completed = Math.max(0, elapsed - 1)
  return completed * Number(goal.amount_per_cadence)
}

// Walk forward through every cadence-unit from start to asOf, simulating
// the bank carryover. Returns the streak at asOf and the remaining bank.
//
// Algorithm: for each past unit, sum that unit's contributions and add the
// carried bank. If the total meets the cadence amount, the unit is covered
// (streak += 1, surplus banks). If not, the streak resets — and the partial
// total carries forward as the new starting bank for the next unit. The
// CURRENT unit is treated as in-progress: it's counted toward streak only
// if already covered, but failing to cover it yet doesn't break the streak.
function walkStreakAndBank(
  goal: Pick<SavingsGoal, 'cadence' | 'amount_per_cadence' | 'start_date'>,
  entries: SavingsEntry[],
  asOf: Date,
): { streak: number; bank: number } | null {
  if (!goal.cadence || goal.amount_per_cadence == null) return null
  const cadenceAmt = Number(goal.amount_per_cadence)
  if (cadenceAmt <= 0) return { streak: 0, bank: 0 }

  // Aggregate entries by unit. Skips, withdrawals, and BOTH adjustment
  // directions are excluded — they live in a different lane from the
  // daily-ritual streak. Pulling $100 out for an emergency (or getting a
  // $50 birthday gift dropped into savings) shouldn't affect the
  // "did I show up today?" question. Only contributions + catchups count.
  const byUnit = new Map<string, number>()
  for (const e of entries) {
    if (e.kind !== 'contribution' && e.kind !== 'catchup') continue
    const key = unitKey(goal.cadence, e.contributed_on)
    byUnit.set(key, (byUnit.get(key) ?? 0) + (Number(e.amount) || 0))
  }

  const todayKey = todayUnitKey(goal.cadence, asOf)
  let bank = 0
  let streak = 0

  for (const unit of iterateUnits(goal.cadence, goal.start_date, asOf)) {
    const contributed = byUnit.get(unit) ?? 0
    const isCurrent = unit === todayKey
    const available = contributed + bank

    if (available >= cadenceAmt) {
      bank = available - cadenceAmt
      streak += 1
    } else if (isCurrent) {
      // Current unit not yet covered — don't break, don't increment.
      // Keep bank as-is (the available amount is still in flight).
      bank = available
    } else {
      // Past unit not covered — streak breaks; partial survives as bank.
      streak = 0
      bank = available
    }
  }

  return { streak, bank }
}

// A goal is "complete" when:
//   - target_amount is set AND we've hit/exceeded it, OR
//   - target_date is set AND the date has passed (regardless of amount —
//     the deadline is the goal in date-only mode).
// If neither target is set, the goal is open-ended and never auto-completes.
export function isGoalComplete(
  goal: Pick<SavingsGoal, 'target_amount' | 'target_date'>,
  total: number,
  asOf: Date = new Date(),
): boolean {
  if (goal.target_amount != null && total >= Number(goal.target_amount)) return true
  if (goal.target_date != null) {
    const target = parseYMD(goal.target_date)
    if (asOf > target) return true
  }
  return false
}

// Projected total at the goal's target_date (or 5 years out if no target_date).
// Treats the savings as non-invested by default (rate = 0), since this is a
// commitment-tracker, not an invested-account projection. The `rate` arg lets
// the Dad Math link supply the user's assumed return rate when the goal is
// tied to a Dad Math projection.
export function projectedTotalAt(
  goal: Pick<SavingsGoal, 'cadence' | 'amount_per_cadence' | 'target_date'>,
  currentTotal: number,
  atIsoDate: string,
  annualReturnRate: number = 0,
): number | null {
  if (!goal.cadence || goal.amount_per_cadence == null) return null
  const target = parseYMD(atIsoDate)
  const now = new Date()
  const msUntil = target.getTime() - now.getTime()
  if (msUntil <= 0) return currentTotal
  const yearsRemaining = msUntil / (365.25 * MS_PER_DAY)

  // Normalize cadence amount to a monthly PMT so we can reuse dad-math.ts
  // futureValue (which is monthly-compounding under the hood).
  let monthlyPmt: number
  switch (goal.cadence) {
    case 'daily':   monthlyPmt = Number(goal.amount_per_cadence) * (365.25 / 12); break
    case 'weekly':  monthlyPmt = Number(goal.amount_per_cadence) * (52 / 12); break
    case 'monthly': monthlyPmt = Number(goal.amount_per_cadence); break
  }

  return futureValue(currentTotal, monthlyPmt, annualReturnRate, yearsRemaining)
}

// Catch-up suggestion — symmetric mode. The deficit (in cadence-units) is
// repaid over the same number of units, by doubling the per-unit contribution
// during that window. Auto-scales to severity: small deficit → quick catch-up;
// large deficit → longer ramp. Returns null when the goal isn't behind or
// when cadence isn't set.
function buildCatchUpSuggestion(
  goal: Pick<SavingsGoal, 'cadence' | 'amount_per_cadence'>,
  total: number,
  expected: number | null,
  asOf: Date,
): CatchUpSuggestion | null {
  if (!goal.cadence || goal.amount_per_cadence == null) return null
  if (expected == null) return null
  const cadenceAmt = Number(goal.amount_per_cadence)
  if (cadenceAmt <= 0) return null

  const shortfall = expected - total
  if (shortfall <= 0) return null  // not behind

  const shortfallUnits = Math.max(1, Math.ceil(shortfall / cadenceAmt))
  const extraPerUnit = cadenceAmt
  const totalPerUnit = cadenceAmt + extraPerUnit

  // Walk shortfallUnits forward from asOf to get the catch-up-until date.
  const until = new Date(asOf)
  switch (goal.cadence) {
    case 'daily':
      until.setDate(until.getDate() + shortfallUnits)
      break
    case 'weekly':
      until.setDate(until.getDate() + shortfallUnits * 7)
      break
    case 'monthly':
      until.setMonth(until.getMonth() + shortfallUnits)
      break
  }

  const ymd = `${until.getFullYear()}-${pad2(until.getMonth() + 1)}-${pad2(until.getDate())}`

  return {
    shortfall:        Math.round(shortfall * 100) / 100,
    shortfallUnits,
    extraPerUnit,
    totalPerUnit,
    unitsToCatchUp:   shortfallUnits,
    catchUpUntilDate: ymd,
  }
}

// One-shot stats roll-up — what every UI surface and email needs.
export function computeStats(
  goal: SavingsGoal,
  entries: SavingsEntry[],
  asOf: Date = new Date(),
): GoalStats {
  const total = runningTotal(entries)
  const grossContributed = sumByKind(entries, ['contribution', 'catchup', 'adjustment_credit'])
  const grossWithdrawn   = sumByKind(entries, ['withdrawal', 'adjustment_debit'])

  // Distinct contributed/skipped dates (withdrawals aren't a daily activity)
  const contribDates = new Set<string>()
  const skipDates = new Set<string>()
  let lastEntryAt: string | null = null
  for (const e of entries) {
    if (e.kind === 'skip') skipDates.add(e.contributed_on)
    else if (e.kind === 'contribution' || e.kind === 'catchup') contribDates.add(e.contributed_on)
    if (!lastEntryAt || e.created_at > lastEntryAt) lastEntryAt = e.created_at
  }

  const expected = expectedTotalAsOf(goal, asOf)
  const sb = walkStreakAndBank(goal, entries, asOf)
  const cadenceAmt = goal.amount_per_cadence != null ? Number(goal.amount_per_cadence) : null

  let bankedUnits: number | null = null
  let aheadByUnits: number | null = null
  if (sb && cadenceAmt && cadenceAmt > 0 && expected != null) {
    bankedUnits = Math.floor(sb.bank / cadenceAmt)
    aheadByUnits = Math.floor((total - expected) / cadenceAmt)
  }

  const projectedAtTarget = goal.target_date
    ? projectedTotalAt(goal, total, goal.target_date)
    : null

  const catchUpSuggestion = buildCatchUpSuggestion(goal, total, expected, asOf)

  return {
    runningTotal:      total,
    totalContributed:  grossContributed,
    totalWithdrawn:    grossWithdrawn,
    daysContributed:   contribDates.size,
    daysSkipped:       skipDates.size,
    lastEntryAt,
    streak:            sb?.streak ?? null,
    bankedUnits,
    aheadByUnits,
    expectedTotal:     expected,
    isComplete:        isGoalComplete(goal, total, asOf),
    projectedAtTarget,
    catchUpSuggestion,
  }
}

// ── Formatters ──────────────────────────────────────────────────────────────

export function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export function fmtUsdWhole(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

// "1 day" / "5 days" / "1 week" / "3 months" — label for the streak chip.
export function cadenceUnitLabel(cadence: SavingsCadence, n: number): string {
  const noun = cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}

// Format a YYYY-MM-DD string for display in the user's locale WITHOUT
// timezone shift. `new Date('2026-05-28')` parses as UTC midnight, then
// toLocaleDateString shifts to local — so US Eastern would see "May 27".
// We parse the components as local time (matching parseYMD) so the displayed
// day always matches the stored day.
export function fmtYMDForDisplay(
  ymd: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts)
}

// Build today's YMD in the caller's local time. Pass to Server Actions when
// the user's "today" matters more than the server's. The server defaults to
// its own clock when no override is supplied.
export function todayYMDLocal(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
