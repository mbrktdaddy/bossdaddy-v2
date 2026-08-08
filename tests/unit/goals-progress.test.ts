import { describe, it, expect } from 'vitest'
import {
  computeStreak, adherenceRate, latestValue, progressToTarget, compareToTarget,
  planWindow, VOTE_KINDS,
  type EntryLike, type OccurrenceLike,
} from '@/lib/goals/progress'

// These numbers are what a dad sees when he opens the page, so the tests encode
// the two judgement calls that matter:
//   • an unlogged TODAY doesn't break a streak (it's still in progress)
//   • an unresolved occurrence isn't a miss (it hasn't happened yet)
// Both exist so the tracker can't tell someone they failed at something that's
// still ahead of them.

const done = (local_date: string): EntryLike => ({ local_date, kind: 'completed', value: null })

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const entries = [done('2026-08-07'), done('2026-08-06'), done('2026-08-05')]
    expect(computeStreak(entries, '2026-08-07')).toBe(3)
  })

  it('treats an unlogged TODAY as grace, not a break', () => {
    const entries = [done('2026-08-06'), done('2026-08-05')]
    expect(computeStreak(entries, '2026-08-07')).toBe(2)
  })

  it('stops at the first gap', () => {
    const entries = [done('2026-08-07'), done('2026-08-06'), done('2026-08-03')]
    expect(computeStreak(entries, '2026-08-07')).toBe(2)
  })

  it('counts a catch-up the same as a completion', () => {
    const entries: EntryLike[] = [
      done('2026-08-07'),
      { local_date: '2026-08-06', kind: 'catchup', value: null },
    ]
    expect(computeStreak(entries, '2026-08-07')).toBe(2)
  })

  it('an explicit skip breaks the run', () => {
    const entries: EntryLike[] = [
      { local_date: '2026-08-07', kind: 'skipped', value: null },
      done('2026-08-06'),
    ]
    expect(computeStreak(entries, '2026-08-07')).toBe(0)
  })

  it('crosses a month boundary and a DST boundary', () => {
    expect(computeStreak([done('2026-08-01'), done('2026-07-31'), done('2026-07-30')], '2026-08-01')).toBe(3)
    // Nov 1 2026 is a 25-hour day in America/New_York; calendar math must not care.
    expect(computeStreak([done('2026-11-02'), done('2026-11-01'), done('2026-10-31')], '2026-11-02')).toBe(3)
  })

  it('returns 0 for an empty log or a malformed today', () => {
    expect(computeStreak([], '2026-08-07')).toBe(0)
    expect(computeStreak([done('2026-08-07')], 'today')).toBe(0)
  })
})

describe('adherenceRate', () => {
  const occ = (status: string): OccurrenceLike => ({ local_date: '2026-08-01', status, target_value: null })

  it('ignores days that have not happened yet', () => {
    // 2 done, 1 missed, 5 still pending → 67%, not 25%.
    const rows = [occ('completed'), occ('completed'), occ('missed'),
      occ('pending'), occ('pending'), occ('pending'), occ('pending'), occ('pending')]
    expect(adherenceRate(rows)).toEqual({ done: 2, total: 3, pct: 67 })
  })

  it('does not count a snoozed day against you', () => {
    expect(adherenceRate([occ('completed'), occ('snoozed')])).toEqual({ done: 1, total: 1, pct: 100 })
  })

  it('counts a skip as resolved-but-not-done', () => {
    expect(adherenceRate([occ('completed'), occ('skipped')])).toEqual({ done: 1, total: 2, pct: 50 })
  })

  it('returns null rather than 0% for a brand-new goal', () => {
    expect(adherenceRate([occ('pending'), occ('pending')]))
      .toEqual({ done: 0, total: 0, pct: null })
  })
})

describe('latestValue', () => {
  it('picks the newest local date, not array order', () => {
    const entries: EntryLike[] = [
      { local_date: '2026-08-05', kind: 'completed', value: 9 },
      { local_date: '2026-08-07', kind: 'completed', value: 6 },
      { local_date: '2026-08-06', kind: 'completed', value: 7 },
    ]
    expect(latestValue(entries)).toEqual({ value: 6, localDate: '2026-08-07' })
  })

  it('skips valueless entries', () => {
    expect(latestValue([done('2026-08-07')])).toBeNull()
  })
})

describe('progressToTarget', () => {
  it('reads a downward taper as forward motion', () => {
    expect(progressToTarget(20, 0, 20)).toBe(0)
    expect(progressToTarget(20, 0, 10)).toBe(0.5)
    expect(progressToTarget(20, 0, 0)).toBe(1)
  })

  it('reads an upward goal identically', () => {
    expect(progressToTarget(150, 170, 160)).toBe(0.5)
  })

  it('clamps rather than reporting 140%', () => {
    expect(progressToTarget(20, 0, -5)).toBe(1)
    expect(progressToTarget(20, 0, 25)).toBe(0)
  })

  it('returns null when there is nothing to compare', () => {
    expect(progressToTarget(null, 0, 5)).toBeNull()
    expect(progressToTarget(20, 0, null)).toBeNull()
  })
})

describe('compareToTarget', () => {
  it('knows which side of the number is good', () => {
    expect(compareToTarget(6, 8, 'down')).toBe('better')
    expect(compareToTarget(9, 8, 'down')).toBe('over')
    expect(compareToTarget(9, 8, 'up')).toBe('better')
    expect(compareToTarget(8, 8, 'down')).toBe('met')
    expect(compareToTarget(9, 8, 'hold')).toBe('over')
  })

  it('defaults to down when direction is unset', () => {
    expect(compareToTarget(6, 8, null)).toBe('better')
  })
})

// ── the vote window ─────────────────────────────────────────────────────────
// Votes are scoped to the CURRENT PLAN, which is the whole reason this function
// exists: a lifetime counter still reads 47 after a month away, so it stops
// describing now. These tests pin the three ways the phrase could lie —
// counting past the end of a finished plan, claiming a day before the plan
// started, and reporting a day number beyond the plan's length.

describe('planWindow', () => {
  it('spans start to target, inclusive, and says which day of it today is', () => {
    const w = planWindow('2026-08-01', '2026-09-25', '2026-08-24')
    expect(w).not.toBeNull()
    expect(w!.start).toBe('2026-08-01')
    expect(w!.end).toBe('2026-09-25')
    expect(w!.planDays).toBe(56)          // 8 weeks, both ends counted
    expect(w!.dayInPlan).toBe(24)
  })

  it('is day 1 on the first day', () => {
    expect(planWindow('2026-08-01', '2026-09-25', '2026-08-01')!.dayInPlan).toBe(1)
  })

  it('stops the window at the target date rather than at today', () => {
    // Once a plan is over its count is final. Letting `end` drift to today would
    // keep accruing votes against a target that already came and went.
    const w = planWindow('2026-06-01', '2026-07-26', '2026-08-24')!
    expect(w.end).toBe('2026-07-26')
  })

  it('clamps the day number to the plan length once the plan is over', () => {
    // "Day 81 of 56" is a bug on screen even though the arithmetic is right.
    const w = planWindow('2026-06-01', '2026-07-26', '2026-08-24')!
    expect(w.planDays).toBe(56)
    expect(w.dayInPlan).toBe(56)
  })

  it('reports day 0 for a plan that has not started yet', () => {
    // The start date can be in the future — the create form allows it. A plan
    // that hasn't begun is on no day at all, and the caller hides the day clause.
    const w = planWindow('2026-09-01', '2026-10-27', '2026-08-24')!
    expect(w.dayInPlan).toBe(0)
  })

  it('goes open-ended with no target date', () => {
    const w = planWindow('2026-08-01', null, '2026-08-24')!
    expect(w.planDays).toBeNull()         // caller drops "Day X of Y"
    expect(w.end).toBe('2026-08-24')
    expect(w.dayInPlan).toBe(24)
  })

  it('treats a target before the start as open-ended instead of a negative plan', () => {
    const w = planWindow('2026-08-01', '2026-07-01', '2026-08-24')!
    expect(w.planDays).toBeNull()
    expect(w.end).toBe('2026-08-24')
  })

  it('counts calendar days across a spring-forward boundary', () => {
    // UTC-midnight arithmetic on both ends, so the 23-hour day cancels. A plan
    // that spans a DST change must not come out a day short.
    const w = planWindow('2026-03-01', '2026-03-31', '2026-03-31')!
    expect(w.planDays).toBe(31)
    expect(w.dayInPlan).toBe(31)
  })

  it('returns null on a malformed date rather than a wrong number', () => {
    expect(planWindow('not-a-date', null, '2026-08-24')).toBeNull()
    expect(planWindow('2026-08-01', null, 'nope')).toBeNull()
  })
})

describe('VOTE_KINDS', () => {
  it('is showing up, with no target in it', () => {
    // An honest 6 against a target of 5 is still a vote. If a target check ever
    // appears in the vote rule, this is the test that should have stopped it.
    expect([...VOTE_KINDS]).toEqual(['completed', 'catchup'])
  })

  it('agrees with what the streak counts as done', () => {
    // Both answer "did he show up?", so they're derived from one constant. A
    // streak that counted a kind the votes ignored would make two numbers on the
    // same page disagree about the same day.
    const entries: EntryLike[] = VOTE_KINDS.map((kind, i) => ({
      local_date: `2026-08-${String(24 - i).padStart(2, '0')}`,
      kind,
      value: null,
    }))
    for (const entry of entries) {
      expect(computeStreak([entry], entry.local_date)).toBe(1)
    }
  })
})
