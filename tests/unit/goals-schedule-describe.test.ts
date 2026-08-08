import { describe, it, expect } from 'vitest'
import { buildRrule, parseWhen, describeRrule, DAY_TOKENS } from '@/lib/goals/schedule-input'

// parseWhen is the inverse of buildRrule and powers the edit form's prefill: get
// it wrong and editing a schedule silently rewrites it to something the user
// never chose. describeRrule exists because the detail page was rendering raw
// RRULE strings at people.

describe('parseWhen round-trips everything buildRrule can emit', () => {
  it('daily', () => {
    expect(parseWhen(buildRrule('daily', '2026-08-08', []))).toEqual({ when: 'daily', days: [] })
  })

  it('weekdays is recognized as weekdays, not as five picked days', () => {
    expect(parseWhen(buildRrule('weekdays', '2026-08-08', [])))
      .toEqual({ when: 'weekdays', days: ['MO', 'TU', 'WE', 'TH', 'FR'] })
  })

  it('monthly', () => {
    expect(parseWhen(buildRrule('monthly', '2026-08-08', []))).toEqual({ when: 'monthly', days: [] })
  })

  it('every single-day pick', () => {
    for (const day of DAY_TOKENS) {
      expect(parseWhen(buildRrule('days', '2026-08-08', [day])))
        .toEqual({ when: 'days', days: [day] })
    }
  })

  it('multi-day picks, in canonical order', () => {
    expect(parseWhen(buildRrule('days', '2026-08-08', ['FR', 'MO', 'WE'])))
      .toEqual({ when: 'days', days: ['MO', 'WE', 'FR'] })
    expect(parseWhen(buildRrule('days', '2026-08-08', ['SA', 'SU'])))
      .toEqual({ when: 'days', days: ['SA', 'SU'] })
  })

  it('all seven collapses to daily in both directions', () => {
    const rrule = buildRrule('days', '2026-08-08', [...DAY_TOKENS])
    expect(rrule).toBe('FREQ=DAILY')
    expect(parseWhen(rrule)).toEqual({ when: 'daily', days: [] })
  })

  it('re-building from a parsed rule is stable (no drift on a no-op edit)', () => {
    for (const original of [
      'FREQ=DAILY',
      'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'FREQ=WEEKLY;BYDAY=SU',
      'FREQ=MONTHLY;BYMONTHDAY=8',
    ]) {
      const { when, days } = parseWhen(original)
      expect(buildRrule(when, '2026-08-08', days)).toBe(original)
    }
  })

  it('falls back to something editable rather than throwing on an exotic rule', () => {
    expect(parseWhen('FREQ=YEARLY;BYMONTH=3').when).toBe('daily')
    expect(parseWhen('').when).toBe('daily')
    expect(parseWhen('nonsense').when).toBe('daily')
  })

  it('is case-insensitive — a hand-written rule may be lowercase', () => {
    expect(parseWhen('freq=weekly;byday=mo,we,fr')).toEqual({ when: 'days', days: ['MO', 'WE', 'FR'] })
  })
})

describe('describeRrule', () => {
  it('reads like a person wrote it', () => {
    expect(describeRrule('FREQ=DAILY', '06:30')).toBe('Every day at 6:30 AM')
    expect(describeRrule('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', '08:00')).toBe('Weekdays at 8:00 AM')
    expect(describeRrule('FREQ=WEEKLY;BYDAY=MO,WE,FR', '18:15')).toBe('Mon, Wed, Fri at 6:15 PM')
    expect(describeRrule('FREQ=WEEKLY;BYDAY=SU', '07:00')).toBe('Every Sun at 7:00 AM')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=8', '12:00')).toBe('Monthly on the 8th at 12:00 PM')
  })

  it('handles Postgres HH:MM:SS and midnight/noon without lying', () => {
    expect(describeRrule('FREQ=DAILY', '20:00:00')).toBe('Every day at 8:00 PM')
    expect(describeRrule('FREQ=DAILY', '00:30')).toBe('Every day at 12:30 AM')
    expect(describeRrule('FREQ=DAILY', '12:30')).toBe('Every day at 12:30 PM')
  })

  it('gets ordinals right, including the teens', () => {
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=1')).toBe('Monthly on the 1st')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=2')).toBe('Monthly on the 2nd')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=3')).toBe('Monthly on the 3rd')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=11')).toBe('Monthly on the 11th')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=12')).toBe('Monthly on the 12th')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=13')).toBe('Monthly on the 13th')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=21')).toBe('Monthly on the 21st')
    expect(describeRrule('FREQ=MONTHLY;BYMONTHDAY=31')).toBe('Monthly on the 31st')
  })

  it('names an interval instead of pretending it is daily', () => {
    expect(describeRrule('FREQ=DAILY;INTERVAL=3', '09:00')).toBe('Every 3 days at 9:00 AM')
  })

  it('omits the time when there isn\'t one', () => {
    expect(describeRrule('FREQ=DAILY')).toBe('Every day')
  })
})
