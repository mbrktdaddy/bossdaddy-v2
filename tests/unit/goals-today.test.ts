import { describe, it, expect } from 'vitest'
import {
  summarizeTodayWork, todayPreviewItems, type TodayWork, type TodayGoal,
} from '@/lib/goals/today'

// `loadTodayWork` needs a database, but the WORDING is pure and appears on four
// surfaces — /today plus a TodayCard on /goals, /tools and /account. These pin the
// three rules that keep those four in agreement.

const goal = (id: string, title: string): TodayGoal => ({
  id, title, status: 'active', metric_key: null, metric_unit: null, identity_short: null,
})

const occ = (id: string, goal_id: string, local_time: string) => ({
  id, goal_id, local_date: '2026-08-15', local_time,
  status: 'pending', target_value: null, due_at: '2026-08-15T19:00:00.000Z', shifted: false,
})

const work = (over: Partial<TodayWork> = {}): TodayWork => ({
  dueNow: [], later: [], goals: new Map(), activeGoalCount: 1, ...over,
})

describe('summarizeTodayWork', () => {
  it('says nothing at all when there are no active goals', () => {
    // A "Today" card for somebody who hasn't set anything up is an advert, and the
    // surfaces it sits on already invite you to start one.
    expect(summarizeTodayWork(work({ activeGoalCount: 0 }))).toBeNull()
  })

  it('counts what is due and names the oldest one', () => {
    // Oldest, because that's the one most likely to have been forgotten. loadTodayWork
    // orders by due_at ascending, so dueNow[0] IS the oldest.
    const summary = summarizeTodayWork(work({
      dueNow: [occ('a', 'g1', '08:00'), occ('b', 'g2', '20:00')],
      goals: new Map([['g1', goal('g1', 'Take my meds')], ['g2', goal('g2', 'Lift')]]),
    }))!
    expect(summary.tone).toBe('due')
    expect(summary.headline).toBe('2 waiting on you')
    expect(summary.detail).toBe('Take my meds')
    expect(summary.cta).toBe('Do it')
  })

  it('still renders on a clear day, and never as a zero', () => {
    // The old /goals panel was hidden when nothing was due, which removed the only
    // entrance to /today at exactly the moment a man wants the reassurance.
    const summary = summarizeTodayWork(work({
      later: [occ('a', 'g1', '19:00')],
      goals: new Map([['g1', goal('g1', 'Lift')]]),
    }))!
    expect(summary.tone).toBe('clear')
    expect(summary.headline).toBe('All clear right now')
    expect(summary.headline).not.toContain('0')
  })

  it('takes the next time from the occurrence\'s OWN wall clock', () => {
    // Postgres `time` comes back HH:MM:SS and the row already carries the local time
    // for its own schedule's zone — deriving a time from the server's zone here is how
    // a card tells a man 2pm when his reminder is at 8pm.
    expect(summarizeTodayWork(work({
      later: [occ('a', 'g1', '19:30:00')],
      goals: new Map([['g1', goal('g1', 'Lift')]]),
    }))!.detail).toBe('Next at 19:30')
  })

  it('drops the detail when nothing is coming up either', () => {
    expect(summarizeTodayWork(work())!.detail).toBeNull()
  })
})

describe('todayPreviewItems', () => {
  const three = work({
    dueNow: [occ('a', 'g1', '08:00:00'), occ('b', 'g2', '12:30:00'), occ('c', 'g1', '20:00:00')],
    goals: new Map([['g1', goal('g1', 'Take my meds')], ['g2', goal('g2', 'Lift')]]),
  })

  it('names the due items in due order, with their own wall clocks', () => {
    // Naming them is the whole point — a count makes the reader open the page to find
    // out what the two things are, which is the tap the card exists to save.
    expect(todayPreviewItems(three).map((i) => [i.title, i.time])).toEqual([
      ['Take my meds', '08:00'],
      ['Lift', '12:30'],
      ['Take my meds', '20:00'],
    ])
  })

  it('caps the list, because a card that lists everything is the page', () => {
    expect(todayPreviewItems(three, 2)).toHaveLength(2)
  })

  it('carries the day\'s target and unit when the goal measures something', () => {
    const measured = work({
      dueNow: [{ ...occ('a', 'g1', '07:00:00'), target_value: 196 }],
      goals: new Map([['g1', { ...goal('g1', 'Solid 185'), metric_unit: 'lb' }]]),
    })
    expect(todayPreviewItems(measured)[0]).toMatchObject({ target: 196, unit: 'lb' })
  })

  it('survives a goal the map does not have rather than rendering blank', () => {
    // The goals fetch is filtered by user_id, so a mismatch means something is wrong —
    // but a card is not the place to throw.
    expect(todayPreviewItems(work({ dueNow: [occ('a', 'ghost', '09:00:00')] }))[0].title)
      .toBe('Something')
  })

  it('is empty on a clear day', () => {
    expect(todayPreviewItems(work({ later: [occ('a', 'g1', '19:00:00')] }))).toEqual([])
  })
})
