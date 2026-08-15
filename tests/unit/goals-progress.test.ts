import { describe, it, expect } from 'vitest'
import {
  computeStreak, computeScheduledStreak, longestScheduledStreak,
  classifyScheduledDays, keptTotal,
  adherenceRate, recentAdherence, RATE_WINDOW_DAYS, shiftLocalDate,
  latestValue, progressToTarget, compareToTarget,
  planWindow, isPlanFinished, VOTE_KINDS,
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

// ── the schedule-aware streak ───────────────────────────────────────────────
// `computeStreak` above folds by calendar date, which is right for a daily goal
// and WRONG for every other shape: a MO/WE/FR goal hits Tuesday, finds no entry,
// and stops — so "Days running" could never read above 1 on the seeded
// lift-three-times or weigh-in-sundays plans. These tests pin the fix, and the
// first one asserts the old behaviour alongside the new so the reason this
// function exists can't be lost.
//
// 2026-08-03 is a Monday and 2026-08-02 a Sunday — the fixtures below depend on it.

const MWF = ['2026-08-03', '2026-08-05', '2026-08-07',
             '2026-08-10', '2026-08-12', '2026-08-14',
             '2026-08-17', '2026-08-19', '2026-08-21']
const SUNDAYS = ['2026-08-02', '2026-08-09', '2026-08-16', '2026-08-23']

const occOn = (local_date: string, status = 'completed'): OccurrenceLike =>
  ({ local_date, status, target_value: null })

describe('computeScheduledStreak', () => {
  it('counts scheduled days, so Tuesday does not break a MO/WE/FR run', () => {
    const occurrences = MWF.map((d) => occOn(d))
    const entries = MWF.map(done)
    expect(computeScheduledStreak(occurrences, entries)).toBe(9)
    // The whole point: the calendar fold sees a gap on the 4th and gives up.
    expect(computeStreak(entries, '2026-08-21')).toBe(1)
  })

  it('counts a weekly weigh-in as four, not one', () => {
    expect(computeScheduledStreak(SUNDAYS.map((d) => occOn(d)), SUNDAYS.map(done))).toBe(4)
  })

  it('treats a future scheduled day as grace, not a break', () => {
    // Tomorrow is pending and unlogged. It is not a miss.
    const occurrences = [...MWF.map((d) => occOn(d)), occOn('2026-08-24', 'pending')]
    expect(computeScheduledStreak(occurrences, MWF.map(done))).toBe(9)
  })

  it('treats a day still within grace as grace — even a past one', () => {
    // GRACE COMES FROM THE STATUS, not from a comparison against today. An 11pm
    // dose with a four-hour window, or a sweep tick that didn't run, leaves a
    // past-dated row still `pending` — and that must not zero the run.
    const occurrences = [occOn('2026-08-17'), occOn('2026-08-19'), occOn('2026-08-21', 'pending')]
    const entries = [done('2026-08-17'), done('2026-08-19')]
    expect(computeScheduledStreak(occurrences, entries)).toBe(2)
  })

  it('breaks on a resolved miss', () => {
    const occurrences = [occOn('2026-08-17'), occOn('2026-08-19', 'missed'), occOn('2026-08-21')]
    const entries = [done('2026-08-17'), done('2026-08-21')]
    expect(computeScheduledStreak(occurrences, entries)).toBe(1)
  })

  it('breaks on an explicit skip', () => {
    const occurrences = [occOn('2026-08-19'), occOn('2026-08-21', 'skipped')]
    const entries: EntryLike[] = [
      done('2026-08-19'),
      { local_date: '2026-08-21', kind: 'skipped', value: null },
    ]
    expect(computeScheduledStreak(occurrences, entries)).toBe(0)
  })

  it('does not let an off-day log extend the chain', () => {
    // An unprompted Tuesday workout is still a vote and still counts in
    // keptTotal. It is not part of the MO/WE/FR commitment, so it adds nothing
    // here — and it must not break the chain either.
    const entries = [...MWF.map(done), done('2026-08-18')]
    expect(computeScheduledStreak(MWF.map((d) => occOn(d)), entries)).toBe(9)
  })

  it('counts a catch-up the same as a completion', () => {
    const occurrences = [occOn('2026-08-19'), occOn('2026-08-21', 'completed')]
    const entries: EntryLike[] = [
      { local_date: '2026-08-19', kind: 'catchup', value: null },
      done('2026-08-21'),
    ]
    expect(computeScheduledStreak(occurrences, entries)).toBe(2)
  })

  it('is 0 for a goal with no occurrences at all', () => {
    // Callers fall back to computeStreak here — nothing scheduled means there are
    // no scheduled days to walk.
    expect(computeScheduledStreak([], [done('2026-08-21')])).toBe(0)
  })
})

describe('longestScheduledStreak', () => {
  it('survives the day a run breaks', () => {
    const occurrences = ['2026-08-03', '2026-08-05', '2026-08-07']
      .map((d) => occOn(d))
      .concat(occOn('2026-08-10', 'missed'), occOn('2026-08-12'), occOn('2026-08-14'))
    const entries = ['2026-08-03', '2026-08-05', '2026-08-07', '2026-08-12', '2026-08-14'].map(done)
    expect(computeScheduledStreak(occurrences, entries)).toBe(2)   // current run
    expect(longestScheduledStreak(occurrences, entries)).toBe(3)   // best ever
  })

  it('joins the runs either side of an unresolved day', () => {
    // Deliberately generous: an `open` day is not evidence of a miss, and this
    // number's job is to be the one that survives a bad week.
    const occurrences = [occOn('2026-08-03'), occOn('2026-08-05'),
      occOn('2026-08-07', 'pending'), occOn('2026-08-10'), occOn('2026-08-12')]
    const entries = ['2026-08-03', '2026-08-05', '2026-08-10', '2026-08-12'].map(done)
    expect(longestScheduledStreak(occurrences, entries)).toBe(4)
  })

  it('is 0 with no history', () => {
    expect(longestScheduledStreak([], [])).toBe(0)
  })
})

describe('classifyScheduledDays', () => {
  it('returns one entry per scheduled date, in chronological order', () => {
    const occurrences = [occOn('2026-08-07', 'missed'), occOn('2026-08-03'),
      occOn('2026-08-05', 'pending')]
    expect(classifyScheduledDays(occurrences, [done('2026-08-03')])).toEqual([
      { date: '2026-08-03', state: 'kept' },
      { date: '2026-08-05', state: 'open' },
      { date: '2026-08-07', state: 'broken' },
    ])
  })

  it('counts a day with two doses as kept when one is logged', () => {
    // Partial days are kept HERE and 50% in adherenceRate, which is per-occurrence
    // and already carries that detail. One number answering two questions is how
    // both end up untrustworthy.
    const occurrences = [occOn('2026-08-03', 'completed'), occOn('2026-08-03', 'missed')]
    expect(classifyScheduledDays(occurrences, [done('2026-08-03')]))
      .toEqual([{ date: '2026-08-03', state: 'kept' }])
    expect(adherenceRate(occurrences)).toEqual({ done: 1, total: 2, pct: 50 })
  })
})

describe('keptTotal', () => {
  it('counts DATES, not entries — two walks in a day is one day kept', () => {
    expect(keptTotal([done('2026-08-21'), done('2026-08-21'), done('2026-08-19')])).toBe(2)
  })

  it('ignores skips and bare measurements', () => {
    const entries: EntryLike[] = [
      done('2026-08-21'),
      { local_date: '2026-08-19', kind: 'skipped', value: null },
      { local_date: '2026-08-17', kind: 'measurement', value: 184 },
    ]
    expect(keptTotal(entries)).toBe(1)
  })
})

describe('recentAdherence', () => {
  it('measures a 30-day window inclusive of both ends', () => {
    const occurrences = [
      occOn('2026-08-30'),                    // today
      occOn('2026-08-01'),                    // exactly 29 days back — inside
      occOn('2026-07-31', 'missed'),          // 30 days back — outside
    ]
    expect(recentAdherence(occurrences, '2026-08-30')).toEqual({ done: 2, total: 2, pct: 100 })
    // Lifetime still tells the whole truth, which is why both are kept.
    expect(adherenceRate(occurrences)).toEqual({ done: 2, total: 3, pct: 67 })
  })

  it('reads no-data rather than 0% when nothing resolved in the window', () => {
    expect(recentAdherence([occOn('2026-06-01')], '2026-08-30'))
      .toEqual({ done: 0, total: 0, pct: null })
  })

  it('honours a narrower window', () => {
    const occurrences = [occOn('2026-08-30'), occOn('2026-08-29', 'missed')]
    expect(recentAdherence(occurrences, '2026-08-30', 1)).toEqual({ done: 1, total: 1, pct: 100 })
  })

  it('returns no-data on a malformed today rather than a wrong number', () => {
    expect(recentAdherence([occOn('2026-08-30')], 'today'))
      .toEqual({ done: 0, total: 0, pct: null })
  })

  it('names the window the UI names', () => {
    expect(RATE_WINDOW_DAYS).toBe(30)
  })
})

describe('shiftLocalDate', () => {
  it('crosses month and DST boundaries as pure calendar arithmetic', () => {
    expect(shiftLocalDate('2026-08-01', -1)).toBe('2026-07-31')
    // 2026-03-08 is spring-forward in the US; UTC-midnight math must not care.
    expect(shiftLocalDate('2026-03-09', -2)).toBe('2026-03-07')
    expect(shiftLocalDate('2026-08-30', -29)).toBe('2026-08-01')
  })

  it('returns null on a malformed date', () => {
    expect(shiftLocalDate('nope', -1)).toBeNull()
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

// Every bounded fixture below uses `start + weeks * 7`, because that is the only
// target date the app can produce (/api/goals/create). The earlier fixtures used
// `start + 55` and so agreed with a `+1` that made every real 8-week plan render
// "Day 1 of 57" — a green suite describing a plan nothing could create.
const EIGHT_WEEKS_FROM_AUG_1 = '2026-09-26'   // 2026-08-01 + 56
const EIGHT_WEEKS_FROM_JUN_1 = '2026-07-27'   // 2026-06-01 + 56

describe('planWindow', () => {
  it('runs start → target and says which day of it today is', () => {
    const w = planWindow('2026-08-01', EIGHT_WEEKS_FROM_AUG_1, '2026-08-24')
    expect(w).not.toBeNull()
    expect(w!.start).toBe('2026-08-01')
    expect(w!.end).toBe(EIGHT_WEEKS_FROM_AUG_1)
    expect(w!.planDays).toBe(56)          // 8 weeks reads as 8 weeks
    expect(w!.dayInPlan).toBe(24)
  })

  it('is day 1 on the first day', () => {
    expect(planWindow('2026-08-01', EIGHT_WEEKS_FROM_AUG_1, '2026-08-01')!.dayInPlan).toBe(1)
  })

  it('agrees with the target date /api/goals/create actually writes', () => {
    // The regression guard. create does addDays(startDate, weeks * 7) and
    // lib/goals/curve.ts needs that exact span for its step count, so planDays
    // has to be the DURATION. If someone re-adds the inclusive +1 here, or
    // shortens create's span to suit it, one of these two numbers moves.
    for (const weeks of [1, 4, 8, 12]) {
      const target = new Date(Date.UTC(2026, 7, 1) + weeks * 7 * 86_400_000)
        .toISOString().slice(0, 10)
      expect(planWindow('2026-08-01', target, '2026-08-01')!.planDays).toBe(weeks * 7)
    }
  })

  it('stops the window at the target date rather than at today', () => {
    // Once a plan is over its count is final. Letting `end` drift to today would
    // keep accruing votes against a target that already came and went.
    const w = planWindow('2026-06-01', EIGHT_WEEKS_FROM_JUN_1, '2026-08-24')!
    expect(w.end).toBe(EIGHT_WEEKS_FROM_JUN_1)
  })

  it('clamps the day number to the plan length once the plan is over', () => {
    // "Day 81 of 56" is a bug on screen even though the arithmetic is right.
    const w = planWindow('2026-06-01', EIGHT_WEEKS_FROM_JUN_1, '2026-08-24')!
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
    // that spans a DST change must not come out a day short. Spring-forward is
    // 2026-03-08, inside both spans below.
    const w = planWindow('2026-03-01', '2026-03-31', '2026-03-15')!
    expect(w.planDays).toBe(30)
    expect(w.dayInPlan).toBe(15)
  })

  it('returns null on a malformed date rather than a wrong number', () => {
    expect(planWindow('not-a-date', null, '2026-08-24')).toBeNull()
    expect(planWindow('2026-08-01', null, 'nope')).toBeNull()
  })
})

// ── finishing a plan ────────────────────────────────────────────────────────
// `goals.status = 'completed'` and `completed_at` were defined by migration 134 and
// unreachable from anywhere in the product, so a bounded plan ran forever: the
// sweep kept materializing days past the end date and kept nudging, while
// planWindow froze at "Day 56 of 56" and the vote count stopped moving. These pin
// the rule that ends it.

describe('isPlanFinished', () => {
  const base = {
    status: 'active',
    targetDate: EIGHT_WEEKS_FROM_JUN_1,     // 2026-07-27
    todayLocal: '2026-08-24',
    hasUnresolved: false,
  }

  it('finishes a plan whose end date has passed with nothing left open', () => {
    expect(isPlanFinished(base)).toBe(true)
  })

  it('leaves the target day itself playable', () => {
    // Strictly `<`: a plan ending today finishes TOMORROW. Finishing it at midnight
    // would take the last day away from the man who still meant to log it.
    expect(isPlanFinished({ ...base, todayLocal: EIGHT_WEEKS_FROM_JUN_1 })).toBe(false)
    expect(isPlanFinished({ ...base, todayLocal: '2026-07-28' })).toBe(true)
  })

  it('never finishes an open-ended goal', () => {
    // "Take your vitamins" has no end date because there isn't one.
    expect(isPlanFinished({ ...base, targetDate: null })).toBe(false)
  })

  it('waits for anything still in play', () => {
    expect(isPlanFinished({ ...base, hasUnresolved: true })).toBe(false)
  })

  it('only ever finishes an active goal', () => {
    // A parked plan is not a finished one, and re-finishing an already-finished
    // plan would re-stamp completed_at and re-notify. This is what makes the sweep
    // phase idempotent alongside its status-guarded UPDATE.
    for (const status of ['paused', 'archived', 'completed']) {
      expect(isPlanFinished({ ...base, status })).toBe(false)
    }
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
