import { describe, it, expect } from 'vitest'
import { groupDueByGoal, type TodayWork, type TodayGoal, type TodayOccurrence } from '@/lib/goals/today'

// Grouping /today's work per goal instead of per occurrence. The case that forced it: a
// twice-daily medication goal put two or three identical cards on the screen.

function goal(id: string, over: Partial<TodayGoal> = {}): TodayGoal {
  return {
    id,
    title: `Goal ${id}`,
    status: 'active',
    metric_key: null,
    metric_unit: null,
    identity_short: null,
    ...over,
  }
}

function slot(id: string, goalId: string, time: string): TodayOccurrence {
  return {
    id,
    goal_id: goalId,
    local_date: '2026-08-17',
    local_time: `${time}:00`,
    status: 'notified',
    target_value: null,
    due_at: `2026-08-17T${time}:00.000Z`,
    shifted: false,
  }
}

function work(dueNow: TodayOccurrence[], goals: TodayGoal[]): TodayWork {
  return {
    dueNow,
    later: [],
    goals: new Map(goals.map((g) => [g.id, g])),
    activeGoalCount: goals.length,
  }
}

describe('groupDueByGoal', () => {
  it('collapses several slots of one goal into a single group', () => {
    const groups = groupDueByGoal(work(
      [slot('o1', 'g1', '08'), slot('o2', 'g1', '14'), slot('o3', 'g1', '20')],
      [goal('g1')],
    ))
    expect(groups).toHaveLength(1)
    expect(groups[0]!.occurrences.map((o) => o.id)).toEqual(['o1', 'o2', 'o3'])
  })

  it('orders goals by their earliest open slot, and slots by due order within a goal', () => {
    // dueNow arrives oldest-first, interleaved across goals — the shape the loader returns.
    const groups = groupDueByGoal(work(
      [slot('a1', 'g1', '08'), slot('b1', 'g2', '09'), slot('a2', 'g1', '20')],
      [goal('g1'), goal('g2')],
    ))
    expect(groups.map((g) => g.goal.id)).toEqual(['g1', 'g2'])
    expect(groups[0]!.occurrences.map((o) => o.id)).toEqual(['a1', 'a2'])
    expect(groups[1]!.occurrences.map((o) => o.id)).toEqual(['b1'])
  })

  it('keeps every slot — the count of rows must equal the count of work', () => {
    const dueNow = [slot('o1', 'g1', '08'), slot('o2', 'g2', '09'), slot('o3', 'g1', '20')]
    const groups = groupDueByGoal(work(dueNow, [goal('g1'), goal('g2')]))
    expect(groups.reduce((n, g) => n + g.occurrences.length, 0)).toBe(dueNow.length)
  })

  it('drops work whose goal cannot be named rather than inventing a title', () => {
    const groups = groupDueByGoal(work(
      [slot('o1', 'g1', '08'), slot('o2', 'ghost', '09')],
      [goal('g1')],
    ))
    expect(groups.map((g) => g.goal.id)).toEqual(['g1'])
  })

  it('returns nothing for a clear day', () => {
    expect(groupDueByGoal(work([], [goal('g1')]))).toEqual([])
  })
})
