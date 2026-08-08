import { describe, it, expect } from 'vitest'
import { targetForDate, daysBetween, type CurveInput } from '@/lib/goals/curve'

// The curve is what makes a taper or a training program work, and it's stamped
// onto each occurrence at materialization time — so a wrong number here is a
// wrong number in someone's history forever.
//
// The load-bearing rule: an uninterpolatable curve falls back to BASELINE (the
// easiest target), never to the end target. Getting that backwards tells a dad on
// day one of an eight-week taper that today's allowance is zero.

const taper: CurveInput = {
  curve: 'linear',
  baseline_value: 20,
  target_value: 0,
  started_on: '2026-09-01',
  target_date: '2026-10-31',   // 60 days
  step_every_days: null,
}

describe('targetForDate — linear', () => {
  it('returns the baseline on day one and the target on the end date', () => {
    expect(targetForDate(taper, '2026-09-01')).toBe(20)
    expect(targetForDate(taper, '2026-10-31')).toBe(0)
  })

  it('interpolates in between', () => {
    expect(targetForDate(taper, '2026-10-01')).toBe(10)   // 30/60 days
    expect(targetForDate(taper, '2026-09-16')).toBe(15)   // 15/60 days
  })

  it('clamps outside the span instead of extrapolating', () => {
    expect(targetForDate(taper, '2026-08-01')).toBe(20)   // before start
    expect(targetForDate(taper, '2027-01-01')).toBe(0)    // after target date
  })

  it('works upward too — gaining weight is the same code', () => {
    const gain: CurveInput = { ...taper, baseline_value: 150, target_value: 170 }
    expect(targetForDate(gain, '2026-09-01')).toBe(150)
    expect(targetForDate(gain, '2026-10-01')).toBe(160)
    expect(targetForDate(gain, '2026-10-31')).toBe(170)
  })
})

describe('targetForDate — step', () => {
  const stepped: CurveInput = {
    curve: 'step',
    baseline_value: 20,
    target_value: 0,
    started_on: '2026-09-01',
    target_date: '2026-10-27',   // 56 days = 8 steps of 7
    step_every_days: 7,
  }

  it('holds the level for the whole interval, then steps', () => {
    expect(targetForDate(stepped, '2026-09-01')).toBe(20)   // day 0
    expect(targetForDate(stepped, '2026-09-07')).toBe(20)   // day 6 — still week 1
    expect(targetForDate(stepped, '2026-09-08')).toBe(17.5) // day 7 — first step down
    expect(targetForDate(stepped, '2026-09-14')).toBe(17.5) // day 13 — still week 2
    expect(targetForDate(stepped, '2026-09-15')).toBe(15)   // day 14 — second step
  })

  it('lands exactly on target at the end date', () => {
    expect(targetForDate(stepped, '2026-10-27')).toBe(0)
  })

  it('never overshoots past the target', () => {
    expect(targetForDate(stepped, '2026-12-01')).toBe(0)
  })
})

describe('targetForDate — fail-soft', () => {
  it('falls back to BASELINE, not target, when there is no end date', () => {
    const noEnd: CurveInput = { ...taper, target_date: null }
    expect(targetForDate(noEnd, '2026-09-15')).toBe(20)
  })

  it('falls back to baseline when a step curve has no interval', () => {
    const brokenStep: CurveInput = { ...taper, curve: 'step', step_every_days: null }
    expect(targetForDate(brokenStep, '2026-09-15')).toBe(20)
  })

  it('falls back to baseline on a zero-length or inverted span', () => {
    expect(targetForDate({ ...taper, target_date: '2026-09-01' }, '2026-09-15')).toBe(20)
    expect(targetForDate({ ...taper, target_date: '2026-08-01' }, '2026-09-15')).toBe(20)
  })

  it('falls back to baseline on a malformed date rather than throwing', () => {
    expect(targetForDate(taper, 'not-a-date')).toBe(20)
  })
})

describe('targetForDate — flat and adherence goals', () => {
  it('curve=none returns the fixed target', () => {
    const flat: CurveInput = { ...taper, curve: 'none', baseline_value: null, target_value: 8 }
    expect(targetForDate(flat, '2026-09-15')).toBe(8)
  })

  it('returns null when there is nothing to measure (took the vitamin)', () => {
    const adherence: CurveInput = {
      curve: 'none', baseline_value: null, target_value: null,
      started_on: '2026-09-01', target_date: null, step_every_days: null,
    }
    expect(targetForDate(adherence, '2026-09-15')).toBeNull()
  })

  it('treats an unknown curve value as flat rather than guessing', () => {
    expect(targetForDate({ ...taper, curve: 'exponential' }, '2026-09-15')).toBe(0)
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-09-01', '2026-09-02')).toBe(1)
    expect(daysBetween('2026-09-01', '2026-10-01')).toBe(30)
    expect(daysBetween('2026-09-02', '2026-09-01')).toBe(-1)
  })

  it('is unaffected by DST — both dates parse as UTC midnight', () => {
    // Nov 1 2026 is a 25-hour day in America/New_York. A naive local-time diff
    // would round to 1.04 days here; calendar arithmetic must say exactly 1.
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
    expect(daysBetween('2026-03-07', '2026-03-08')).toBe(1)
  })

  it('returns null on malformed input', () => {
    expect(daysBetween('2026-9-1', '2026-09-02')).toBeNull()
    expect(daysBetween('', '2026-09-02')).toBeNull()
  })
})
