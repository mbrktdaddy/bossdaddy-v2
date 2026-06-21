// Pure math + types for Dad Tools. No client/server context — safe in both.
//
// Constants here are named (not magic numbers) so future tuning is one edit.

export const WEEKENDS_BIRTH_TO_18 = 940 // baseline assumption — adjustable

const MS_PER_DAY = 86_400_000
const MS_PER_WEEK = 7 * MS_PER_DAY

export type Milestone =
  | 'until_18'
  | 'next_birthday'
  | 'starts_school'
  | 'gets_license'
  | 'summer'
  | 'custom'

export type Unit = 'weekends' | 'bedtimes'

export function ageInYearsMonths(birthdate: string | null | undefined): { years: number; months: number } {
  if (!birthdate) return { years: 0, months: 0 }
  const birth = new Date(birthdate)
  const now = new Date()
  let years  = now.getFullYear() - birth.getFullYear()
  let months = now.getMonth()    - birth.getMonth()
  if (now.getDate() < birth.getDate()) months -= 1
  if (months < 0) { years -= 1; months += 12 }
  return { years: Math.max(0, years), months: Math.max(0, months) }
}

export function ageInYears(birthdate: string): number {
  return ageInYearsMonths(birthdate).years
}

export function isBrandNew(birthdate: string): boolean {
  const ms = Date.now() - new Date(birthdate).getTime()
  return ms <= 30 * MS_PER_DAY
}

// Returns the target Date for a given milestone, or null for 'custom' without a date.
export function milestoneDate(
  milestone: Milestone,
  birthdate: string | null | undefined,
  customDate?: string | null,
): Date | null {
  // Custom milestones are anchored to their own date, not a birthdate — so an
  // adult family member with no birthdate can still use one. Every other
  // milestone is birth-relative and returns null without a birthdate.
  if (milestone === 'custom') return customDate ? new Date(customDate) : null
  if (!birthdate) return null

  const birth = new Date(birthdate)
  const now = new Date()

  switch (milestone) {
    case 'until_18':
      return new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate())

    case 'next_birthday': {
      const thisYear = new Date(now.getFullYear(), birth.getMonth(), birth.getDate())
      return thisYear > now
        ? thisYear
        : new Date(now.getFullYear() + 1, birth.getMonth(), birth.getDate())
    }

    case 'starts_school':
      // Convention: 5th birthday. The decision spec calls this out as a stable
      // default — we don't try to compute the school district's actual cutoff.
      return new Date(birth.getFullYear() + 5, birth.getMonth(), birth.getDate())

    case 'gets_license':
      // 16th birthday.
      return new Date(birth.getFullYear() + 16, birth.getMonth(), birth.getDate())

    case 'summer': {
      // Next occurrence of June 1. JS months are 0-indexed (5 = June).
      const thisYear = new Date(now.getFullYear(), 5, 1)
      return thisYear > now ? thisYear : new Date(now.getFullYear() + 1, 5, 1)
    }
  }
}

export function isMilestonePassed(
  milestone: Milestone,
  birthdate: string | null | undefined,
  customDate?: string | null,
): boolean {
  // next_birthday + summer roll forward, so they can never be in the past.
  if (milestone === 'next_birthday' || milestone === 'summer') return false
  const md = milestoneDate(milestone, birthdate, customDate)
  if (!md) return false
  return md.getTime() <= Date.now()
}

// Whole weeks remaining from now to the milestone date.
export function weeksUntil(target: Date): number {
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.floor(ms / MS_PER_WEEK)
}

// Whole days remaining from now to the milestone date.
export function daysUntil(target: Date): number {
  const ms = target.getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.floor(ms / MS_PER_DAY)
}

// Translates a milestone date + unit choice into the rendered number.
//   weekends → whole weeks remaining (≈ weekends)
//   bedtimes → whole days remaining
export function unitsRemaining(unit: Unit, target: Date): number {
  return unit === 'weekends' ? weeksUntil(target) : daysUntil(target)
}

// "Day key" for a moment — YYYY-MM-DD in the server's local time. Prefers
// occurred_on (set when the dad backfills a date) and falls back to the
// created_at timestamp. Used to compute "days since last moment" using
// calendar-day semantics rather than millisecond-precise diffs.
export function momentDayKey(
  occurredOn: string | null,
  createdAt: string,
): string {
  if (occurredOn) return occurredOn
  const d = new Date(createdAt)
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// Calendar-day delta between a YYYY-MM-DD key and today. Local time so
// "yesterday" reads as 1 even if the moment crossed midnight UTC. Returns
// 0 for today, never negative.
export function daysSinceDayKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return 0
  const that = new Date(y, m - 1, d).getTime()
  const now  = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.max(0, Math.floor((todayStart - that) / MS_PER_DAY))
}

// % elapsed since birth toward a milestone (0–100). Used for the "you've
// already burned X%" framing on Until-18 results.
export function percentElapsed(birthdate: string | null | undefined, target: Date): number {
  if (!birthdate) return 100
  const birth = new Date(birthdate).getTime()
  const t = target.getTime()
  if (t <= birth) return 100
  const total  = t - birth
  const passed = Date.now() - birth
  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)))
}
