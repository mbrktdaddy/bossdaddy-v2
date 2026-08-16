import { describe, it, expect } from 'vitest'
import { computeStats, goalToday, resolveGoalZone, type SavingsGoal, type SavingsEntry } from '@/lib/dad-tools/savings'
import { localDateInZone, parseLocalYMD } from '@/lib/dates'

/**
 * Audit finding #5 — the savings streak read 0 every evening west of GMT.
 *
 * Contributions are stamped with the BROWSER's local date. Every day key on the
 * read side was derived with `dateToYMD`, which reads local getters — the
 * PROCESS zone, UTC on Vercel. So from 17:00 Pacific the server already thought
 * it was tomorrow, yesterday's unit was uncovered and not current, and
 * `walkStreakAndBank` reset the streak to 0.
 *
 * These tests pin the boundary, not just the happy path: the 19:30 PT instant
 * is the one that used to fail, and 11:00 PT is the control that always passed.
 */

const PACIFIC = 'America/Los_Angeles'

function goal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'g1',
    owner_id: 'u1',
    kid_profile_id: null,
    name: 'Yellowstone',
    description: null,
    cadence: 'daily',
    amount_per_cadence: 5,
    start_date: '2026-08-10',
    timezone: PACIFIC,
    target_amount: null,
    target_date: null,
    destination_mode: 'per_participant',
    destination_url: null,
    destination_type: null,
    destination_label: null,
    reminder_enabled: false,
    reminder_cadence: null,
    reminder_hour_utc: null,
    status: 'active',
    ...overrides,
  } as SavingsGoal
}

/** $5 logged every local day from start through `throughYmd`, inclusive. */
function dailyEntries(startYmd: string, throughYmd: string): SavingsEntry[] {
  const out: SavingsEntry[] = []
  const cur = parseLocalYMD(startYmd)
  const end = parseLocalYMD(throughYmd)
  while (cur <= end) {
    const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    out.push({ id: ymd, goal_id: 'g1', contributor_id: 'u1', contributed_on: ymd, amount: 5, kind: 'contribution' } as SavingsEntry)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

describe('savings streak across the local-day boundary', () => {
  // 2026-08-16T02:30:00Z === 2026-08-15 19:30 Pacific.
  const eveningPT = new Date('2026-08-16T02:30:00Z')
  // 2026-08-15T18:00:00Z === 2026-08-15 11:00 Pacific — same local day, no
  // UTC rollover yet.
  const middayPT = new Date('2026-08-15T18:00:00Z')

  const g = goal()
  // Logged 08-10 through 08-14, and has NOT yet logged today (08-15). This is
  // the scenario that broke: he opens the goal at 19:30 before making the
  // evening's contribution. Logging through today would mask it — the CURRENT
  // unit is deliberately never treated as a break, so the bug only shows on the
  // day that has silently become "yesterday" from the server's point of view.
  const entries = dailyEntries('2026-08-10', '2026-08-14') // five covered days

  it('is the same local day at 11:00 and 19:30 Pacific', () => {
    expect(localDateInZone(middayPT, PACIFIC)).toBe('2026-08-15')
    expect(localDateInZone(eveningPT, PACIFIC)).toBe('2026-08-15')
    // ...even though UTC has already rolled over by the evening. This is the
    // whole bug in one assertion.
    expect(localDateInZone(eveningPT, 'UTC')).toBe('2026-08-16')
  })

  it('holds the streak at 19:30 Pacific (the instant that used to read 0)', () => {
    const stats = computeStats(g, entries, goalToday(g, null, eveningPT))
    expect(stats.streak).toBe(5)
  })

  it('reports the same streak at midday and in the evening', () => {
    const midday = computeStats(g, entries, goalToday(g, null, middayPT))
    const evening = computeStats(g, entries, goalToday(g, null, eveningPT))
    expect(evening.streak).toBe(midday.streak)
  })

  it('regression: a UTC asOf still breaks it — proving the fix is the zone, not luck', () => {
    // What the code did before: derive the day from the raw instant, which on a
    // UTC server means 2026-08-16 while the user is still living 08-15.
    const utcAsOf = parseLocalYMD(localDateInZone(eveningPT, 'UTC'))
    const broken = computeStats(g, entries, utcAsOf)
    expect(broken.streak).toBe(0)
  })

  it('a goal in the owner zone reads the same wherever it is viewed from', () => {
    // A partner in Tokyo requests the page; the stored owner zone must win, so
    // the request zone is ignored entirely.
    const viewedFromTokyo = computeStats(g, entries, goalToday(g, 'Asia/Tokyo', eveningPT))
    const viewedAtHome = computeStats(g, entries, goalToday(g, PACIFIC, eveningPT))
    expect(viewedFromTokyo.streak).toBe(viewedAtHome.streak)
  })
})

describe('resolveGoalZone', () => {
  it('prefers the stored owner zone over the request zone', () => {
    expect(resolveGoalZone(PACIFIC, 'Asia/Tokyo')).toBe(PACIFIC)
  })

  it('falls back to the request zone for rows the backfill could not reach', () => {
    expect(resolveGoalZone(null, 'Asia/Tokyo')).toBe('Asia/Tokyo')
  })

  it('falls back to UTC when there is neither', () => {
    expect(resolveGoalZone(null, null)).toBe('UTC')
  })

  it('rejects a junk zone rather than throwing deep inside Intl', () => {
    // x-vercel-ip-timezone is attacker-influenceable in principle, and an
    // unknown zone makes Intl throw a RangeError halfway through a page render.
    expect(resolveGoalZone('Mars/Olympus_Mons', null)).toBe('UTC')
    expect(resolveGoalZone(null, 'not-a-zone')).toBe('UTC')
  })
})
