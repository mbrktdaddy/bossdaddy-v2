// Goal resolution decides which log a dad's words land in. Getting it wrong writes
// a medication dose he didn't take, or a cigarette count onto his gym habit — so
// the contract under test is mostly about REFUSING.
//
// The rule: an exact match wins, a single partial match wins, two matches on the
// same rung is a question for him, and the only inference allowed is the one that
// can't be wrong (he has exactly one goal).

import { describe, it, expect } from 'vitest'
import { pickGoalByHint, type PickableGoal } from '@/lib/goals/pick'

function goal(over: Partial<PickableGoal> & { id: string; title: string }): PickableGoal {
  return {
    kind: 'adherence',
    status: 'active',
    metric_key: null,
    metric_unit: null,
    direction: null,
    curve: 'none',
    baseline_value: null,
    target_value: null,
    step_every_days: null,
    started_on: '2026-08-01',
    target_date: null,
    identity_statement: null,
    identity_short: null,
    ...over,
  }
}

const smoking = goal({
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Quit smoking',
  kind: 'reduce',
  metric_key: 'cigarettes',
  metric_unit: 'per day',
})
const meds = goal({ id: '22222222-2222-4222-8222-222222222222', title: 'Take my meds' })
const lifting = goal({ id: '33333333-3333-4333-8333-333333333333', title: 'Lift three times a week', kind: 'program' })
const drinking = goal({
  id: '44444444-4444-4444-8444-444444444444',
  title: 'Drink less',
  kind: 'reduce',
  metric_key: 'drinks',
})

const board = [smoking, meds, lifting]

describe('pickGoalByHint — matching', () => {
  it('matches an exact title, case-insensitively', () => {
    expect(pickGoalByHint(board, 'quit smoking')).toEqual({ kind: 'match', goal: smoking })
  })

  it('matches a goal_id handed back from list_goals', () => {
    expect(pickGoalByHint(board, meds.id)).toEqual({ kind: 'match', goal: meds })
  })

  it('matches a fragment of the title', () => {
    expect(pickGoalByHint(board, 'smoking')).toEqual({ kind: 'match', goal: smoking })
    expect(pickGoalByHint(board, 'meds')).toEqual({ kind: 'match', goal: meds })
  })

  it('matches what the goal counts, not just its name', () => {
    // "logged 4 cigarettes" never says the word "smoking".
    expect(pickGoalByHint(board, 'cigarettes')).toEqual({ kind: 'match', goal: smoking })
  })

  it('matches when the hint is a phrase CONTAINING the title', () => {
    expect(pickGoalByHint(board, 'my quit smoking plan')).toEqual({ kind: 'match', goal: smoking })
  })

  it('falls back to a single shared word', () => {
    expect(pickGoalByHint(board, 'lifting session')).toEqual({ kind: 'match', goal: lifting })
  })
})

describe('pickGoalByHint — refusing', () => {
  it('asks which one when two goals match the same way', () => {
    // Both tapers contain neither word exactly, but "less" and "drink"/"smok"
    // overlap — two candidates is a question, never a preference.
    const result = pickGoalByHint([smoking, drinking], 'cutting back')
    expect(result.kind).not.toBe('match')
  })

  it('is ambiguous, not arbitrary, when a word hits two goals', () => {
    const a = goal({ id: 'a1111111-1111-4111-8111-111111111111', title: 'Morning walk' })
    const b = goal({ id: 'b1111111-1111-4111-8111-111111111111', title: 'Evening walk' })
    const result = pickGoalByHint([a, b], 'walk')
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') {
      expect(result.candidates.map((g) => g.id)).toEqual([a.id, b.id])
    }
  })

  it('returns none for a hint that matches nothing', () => {
    expect(pickGoalByHint(board, 'flossing').kind).toBe('none')
  })

  it('returns none for an unknown id rather than falling through to word matching', () => {
    // A stale id from an earlier turn must not quietly resolve to some other goal.
    expect(pickGoalByHint(board, '99999999-9999-4999-8999-999999999999').kind).toBe('none')
  })

  it('never resolves against an empty board', () => {
    expect(pickGoalByHint([], 'smoking').kind).toBe('none')
  })

  it('ignores stopwords so unrelated goals do not collide', () => {
    // "log my goal for today" is all filler — it must not match "Take my meds"
    // just because both contain "my".
    expect(pickGoalByHint(board, 'log my thing for today').kind).not.toBe('match')
  })
})

describe('pickGoalByHint — the one safe inference', () => {
  it('resolves a pronoun when there is exactly one goal', () => {
    expect(pickGoalByHint([meds], 'it')).toEqual({ kind: 'match', goal: meds })
    expect(pickGoalByHint([meds], '')).toEqual({ kind: 'match', goal: meds })
  })

  it('refuses a pronoun when there is more than one goal', () => {
    const result = pickGoalByHint(board, 'it')
    expect(result.kind).toBe('ambiguous')
    if (result.kind === 'ambiguous') expect(result.candidates).toHaveLength(3)
  })

  it('does NOT resolve an unrelated hint just because there is one goal', () => {
    // The dangerous version of the inference: "log my run" with only a medication
    // goal on the board must not log medication.
    expect(pickGoalByHint([meds], 'my run').kind).toBe('none')
  })
})

describe('pickGoalByHint — inflected speech', () => {
  // Nobody conjugates their sentence to match a goal title. These are the exact
  // phrasings a dad actually types.
  it('finds a goal through an -ing or -ed ending', () => {
    expect(pickGoalByHint(board, 'lifting session')).toEqual({ kind: 'match', goal: lifting })
    expect(pickGoalByHint([smoking, meds], 'smoked 4 today')).toEqual({ kind: 'match', goal: smoking })
  })

  it('finds a goal through a plural', () => {
    const walk = goal({ id: 'c1111111-1111-4111-8111-111111111111', title: 'Morning walk' })
    expect(pickGoalByHint([walk, meds], 'walked this morning')).toEqual({ kind: 'match', goal: walk })
  })

  it('still refuses when the stem hits two goals', () => {
    expect(pickGoalByHint([smoking, drinking], 'drinking and smoking').kind).toBe('ambiguous')
  })
})
