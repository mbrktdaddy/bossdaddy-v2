import { describe, it, expect } from 'vitest'
import { buildRrule, normalizeDays } from '@/lib/goals/schedule-input'
import { expandOccurrences, assertValidSchedule } from '@/lib/goals/recurrence'

// The picker's job is to turn checkboxes into a rule the cron will expand for
// years. These tests assert both halves: the string we build, and that the string
// actually produces the days the user asked for.

describe('normalizeDays', () => {
  it('sorts into canonical Monday-first order regardless of submission order', () => {
    expect(normalizeDays(['FR', 'MO', 'WE'])).toEqual(['MO', 'WE', 'FR'])
    expect(normalizeDays(['SU', 'SA'])).toEqual(['SA', 'SU'])
  })

  it('dedupes repeated values', () => {
    expect(normalizeDays(['MO', 'MO', 'MO'])).toEqual(['MO'])
  })

  it('drops anything that isn\'t a real token', () => {
    expect(normalizeDays(['MO', 'MONDAY', 'xx', ''])).toEqual(['MO'])
    expect(normalizeDays([])).toEqual([])
  })
})

describe('buildRrule', () => {
  it('builds the fixed shapes', () => {
    expect(buildRrule('daily', '2026-08-07', [])).toBe('FREQ=DAILY')
    expect(buildRrule('weekdays', '2026-08-07', [])).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
  })

  it('builds a weekly rule from picked days, canonically ordered', () => {
    expect(buildRrule('days', '2026-08-07', ['FR', 'MO', 'WE']))
      .toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR')
  })

  it('a single day is a weekly rule — that\'s how the Sunday weigh-in works', () => {
    expect(buildRrule('days', '2026-08-07', ['SU'])).toBe('FREQ=WEEKLY;BYDAY=SU')
  })

  it('all seven days collapses to FREQ=DAILY', () => {
    expect(buildRrule('days', '2026-08-07', ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']))
      .toBe('FREQ=DAILY')
  })

  it('pins the monthly rule to the start date\'s day of month', () => {
    expect(buildRrule('monthly', '2026-08-07', [])).toBe('FREQ=MONTHLY;BYMONTHDAY=7')
    expect(buildRrule('monthly', '2026-08-31', [])).toBe('FREQ=MONTHLY;BYMONTHDAY=31')
  })
})

describe('every picker output is a schedule the engine accepts', () => {
  const base = { startDate: '2026-08-07', localTime: '06:30', timezone: 'America/Chicago' }

  it('validates for every combination the UI can produce', () => {
    const rules = [
      buildRrule('daily', base.startDate, []),
      buildRrule('weekdays', base.startDate, []),
      buildRrule('monthly', base.startDate, []),
      ...['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].map((d) => buildRrule('days', base.startDate, [d])),
      buildRrule('days', base.startDate, ['MO', 'WE', 'FR']),
      buildRrule('days', base.startDate, ['SA', 'SU']),
      buildRrule('days', base.startDate, ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']),
    ]
    for (const rrule of rules) {
      expect(() => assertValidSchedule({ ...base, rrule })).not.toThrow()
    }
  })

  it('produces exactly the weekdays the user checked', () => {
    // Aug 10 2026 is a Monday. Two weeks of Tue/Thu should be Aug 11, 13, 18, 20.
    const rrule = buildRrule('days', '2026-08-10', ['TH', 'TU'])
    const dates = expandOccurrences(
      { ...base, startDate: '2026-08-10', rrule },
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-08-22T00:00:00Z'),
    ).map((o) => o.localDate)
    expect(dates).toEqual(['2026-08-11', '2026-08-13', '2026-08-18', '2026-08-20'])
  })

  it('a Sunday-only pick lands on Sundays', () => {
    const rrule = buildRrule('days', '2026-08-10', ['SU'])
    const dates = expandOccurrences(
      { ...base, startDate: '2026-08-10', rrule },
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-09-01T00:00:00Z'),
    ).map((o) => o.localDate)
    expect(dates).toEqual(['2026-08-16', '2026-08-23', '2026-08-30'])
  })

  it('weekdays-only skips the weekend', () => {
    const rrule = buildRrule('weekdays', '2026-08-10', [])
    const dates = expandOccurrences(
      { ...base, startDate: '2026-08-10', rrule },
      new Date('2026-08-10T00:00:00Z'),
      new Date('2026-08-18T00:00:00Z'),
    ).map((o) => o.localDate)
    expect(dates).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',  // Mon–Fri
      '2026-08-17',                                                          // next Mon
    ])
  })

  it('all-seven behaves identically to every day', () => {
    const window = [new Date('2026-08-10T00:00:00Z'), new Date('2026-08-15T00:00:00Z')] as const
    const asDaily = expandOccurrences(
      { ...base, startDate: '2026-08-10', rrule: buildRrule('daily', '2026-08-10', []) },
      window[0], window[1],
    ).map((o) => o.dueAt.toISOString())
    const asAllDays = expandOccurrences(
      { ...base, startDate: '2026-08-10', rrule: buildRrule('days', '2026-08-10', ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']) },
      window[0], window[1],
    ).map((o) => o.dueAt.toISOString())
    expect(asAllDays).toEqual(asDaily)
  })
})
