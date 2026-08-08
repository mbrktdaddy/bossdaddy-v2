import { describe, it, expect, afterAll } from 'vitest'
import {
  expandOccurrences,
  nextOccurrence,
  assertValidSchedule,
  icsRuleLines,
  localDateInZone,
  isValidTimeZone,
  RecurrenceError,
  MAX_OCCURRENCES,
  type GoalSchedule,
} from '@/lib/goals/recurrence'

// Acceptance gate for the goals recurrence engine.
//
// Two failure modes these tests exist to prevent, both of which shipped in a
// real library and both of which are invisible without exact-instant asserts:
//
//   1. PROCESS-TIMEZONE LEAKAGE — `rrule@2.8.1` converted wall clock to instant
//      by subtracting "target zone minus the process's zone", so the same rule
//      produced different instants on a dev box than in a UTC deployment.
//   2. STICKY DST GAP SHIFT — `rrule-temporal@2.0.2` holds the UTC instant
//      after a spring-forward gap and lets the wall clock drift forever on the
//      DAILY / MONTHLY / YEARLY paths. lib/goals/recurrence.ts corrects it.
//
// Reference dates: US DST ends Sun Nov 1 2026 (02:00 EDT → 01:00 EST) and
// starts Sun Mar 8 2026 (02:00 EST → 03:00 EDT). Australia/Sydney DST starts
// Sun Oct 4 2026.

const isos = (schedule: GoalSchedule, from: string, to: string) =>
  expandOccurrences(schedule, new Date(from), new Date(to)).map((o) => o.dueAt.toISOString())

const NY_0630: GoalSchedule = {
  rrule: 'FREQ=DAILY',
  startDate: '2026-10-29',
  localTime: '06:30',
  timezone: 'America/New_York',
}

describe('expandOccurrences — DST correctness', () => {
  it('holds the local wall clock across the fall-back transition', () => {
    // 06:30 America/New_York every day: 10:30Z under EDT, 11:30Z under EST.
    expect(isos(NY_0630, '2026-10-29T00:00:00Z', '2026-11-03T00:00:00Z')).toEqual([
      '2026-10-29T10:30:00.000Z',
      '2026-10-30T10:30:00.000Z',
      '2026-10-31T10:30:00.000Z',
      '2026-11-01T11:30:00.000Z',
      '2026-11-02T11:30:00.000Z',
    ])
  })

  it('fires ONCE on the fall-back overlap, taking the earlier reading', () => {
    // 01:30 happens twice on Nov 1 2026. RFC 5545 semantics pick the first
    // (EDT, 05:30Z). Firing twice would double-log a medication dose.
    const overlap: GoalSchedule = { ...NY_0630, startDate: '2026-10-31', localTime: '01:30' }
    const occurrences = expandOccurrences(
      overlap, new Date('2026-10-31T00:00:00Z'), new Date('2026-11-03T00:00:00Z'),
    )
    expect(occurrences.map((o) => o.dueAt.toISOString())).toEqual([
      '2026-10-31T05:30:00.000Z',
      '2026-11-01T05:30:00.000Z',
      '2026-11-02T06:30:00.000Z',
    ])
    expect(occurrences.filter((o) => o.localDate === '2026-11-01')).toHaveLength(1)
    expect(occurrences.every((o) => o.localTime === '01:30')).toBe(true)
    expect(occurrences.some((o) => o.shifted)).toBe(false)
  })

  it('shifts forward through the spring-forward gap and then SNAPS BACK', () => {
    // The upstream regression: without the re-anchor in the wrapper, Mar 9-11
    // stay at 07:30Z / 03:30 local forever.
    const gap: GoalSchedule = { ...NY_0630, startDate: '2026-03-06', localTime: '02:30' }
    const occurrences = expandOccurrences(
      gap, new Date('2026-03-06T00:00:00Z'), new Date('2026-03-12T00:00:00Z'),
    )
    expect(occurrences.map((o) => [o.localDate, o.dueAt.toISOString(), o.localTime])).toEqual([
      ['2026-03-06', '2026-03-06T07:30:00.000Z', '02:30'],
      ['2026-03-07', '2026-03-07T07:30:00.000Z', '02:30'],
      ['2026-03-08', '2026-03-08T07:30:00.000Z', '03:30'],  // gap day, shifted
      ['2026-03-09', '2026-03-09T06:30:00.000Z', '02:30'],  // snapped back
      ['2026-03-10', '2026-03-10T06:30:00.000Z', '02:30'],
      ['2026-03-11', '2026-03-11T06:30:00.000Z', '02:30'],
    ])
    // Only the true gap day is flagged — that's what the UI explains to the user.
    expect(occurrences.filter((o) => o.shifted).map((o) => o.localDate)).toEqual(['2026-03-08'])
  })

  it('snaps back on the MONTHLY path too (same upstream defect)', () => {
    const monthly: GoalSchedule = {
      rrule: 'FREQ=MONTHLY',
      startDate: '2026-01-08',
      localTime: '02:30',
      timezone: 'America/New_York',
    }
    expect(isos(monthly, '2026-01-01T00:00:00Z', '2026-06-01T00:00:00Z')).toEqual([
      '2026-01-08T07:30:00.000Z',
      '2026-02-08T07:30:00.000Z',
      '2026-03-08T07:30:00.000Z',  // gap day
      '2026-04-08T06:30:00.000Z',  // would be 07:30Z uncorrected
      '2026-05-08T06:30:00.000Z',
    ])
  })

  it('handles a half-hour offset zone with no DST', () => {
    const kolkata: GoalSchedule = { ...NY_0630, timezone: 'Asia/Kolkata' }
    expect(isos(kolkata, '2026-10-29T00:00:00Z', '2026-11-01T00:00:00Z')).toEqual([
      '2026-10-29T01:00:00.000Z',
      '2026-10-30T01:00:00.000Z',
      '2026-10-31T01:00:00.000Z',
    ])
  })

  it('handles southern-hemisphere DST start (Sydney, Oct 4 2026)', () => {
    const sydney: GoalSchedule = {
      rrule: 'FREQ=DAILY',
      startDate: '2026-10-03',
      localTime: '07:00',
      timezone: 'Australia/Sydney',
    }
    const occurrences = expandOccurrences(
      sydney, new Date('2026-10-02T00:00:00Z'), new Date('2026-10-05T00:00:00Z'),
    )
    expect(occurrences.map((o) => o.dueAt.toISOString())).toEqual([
      '2026-10-02T21:00:00.000Z',
      '2026-10-03T20:00:00.000Z',
      '2026-10-04T20:00:00.000Z',
    ])
    // The local date is NOT the UTC date — this is why entries key on localDate.
    expect(occurrences[0]!.localDate).toBe('2026-10-03')
    expect(occurrences[0]!.dueAt.toISOString().slice(0, 10)).toBe('2026-10-02')
  })

  it('keeps weekday AND wall clock stable for BYDAY rules across DST', () => {
    const mwf: GoalSchedule = { ...NY_0630, rrule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR' }
    const occurrences = expandOccurrences(
      mwf, new Date('2026-10-29T00:00:00Z'), new Date('2026-11-12T00:00:00Z'),
    )
    expect(occurrences.map((o) => o.dueAt.toISOString())).toEqual([
      '2026-10-30T10:30:00.000Z',  // Fri
      '2026-11-02T11:30:00.000Z',  // Mon, now EST
      '2026-11-04T11:30:00.000Z',
      '2026-11-06T11:30:00.000Z',
      '2026-11-09T11:30:00.000Z',
      '2026-11-11T11:30:00.000Z',
    ])
    expect(occurrences.every((o) => o.localTime === '06:30')).toBe(true)
  })
})

describe('expandOccurrences — process-timezone independence', () => {
  const originalTz = process.env.TZ
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  // The single most important test in this file. `rrule@2.8.1` failed exactly
  // here: identical inputs, different answers per machine.
  it('returns identical instants regardless of the process zone', () => {
    const expected = [
      '2026-10-29T10:30:00.000Z',
      '2026-10-30T10:30:00.000Z',
      '2026-10-31T10:30:00.000Z',
      '2026-11-01T11:30:00.000Z',
      '2026-11-02T11:30:00.000Z',
    ]
    for (const zone of ['UTC', 'America/Chicago', 'Asia/Kolkata', 'Pacific/Auckland', 'Europe/London']) {
      process.env.TZ = zone
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).not.toBe('')
      expect(isos(NY_0630, '2026-10-29T00:00:00Z', '2026-11-03T00:00:00Z'),
      ).toEqual(expected)
    }
  })

  it('resolves the gap correction identically in every process zone', () => {
    const gap: GoalSchedule = { ...NY_0630, startDate: '2026-03-06', localTime: '02:30' }
    const seen = new Set<string>()
    for (const zone of ['UTC', 'America/Chicago', 'Pacific/Auckland']) {
      process.env.TZ = zone
      seen.add(isos(gap, '2026-03-06T00:00:00Z', '2026-03-12T00:00:00Z').join('|'))
    }
    expect(seen.size).toBe(1)
  })
})

describe('nextOccurrence', () => {
  it('returns the next instant strictly after the given time', () => {
    expect(nextOccurrence(NY_0630, new Date('2026-11-01T00:00:00Z'))?.dueAt.toISOString())
      .toBe('2026-11-01T11:30:00.000Z')
  })

  it('returns null once a bounded rule is spent', () => {
    const bounded: GoalSchedule = { ...NY_0630, rrule: 'FREQ=DAILY;COUNT=2' }
    expect(nextOccurrence(bounded, new Date('2027-01-01T00:00:00Z'))).toBeNull()
  })

  it('hands back a plain Date — no Temporal object leaks out of the wrapper', () => {
    const next = nextOccurrence(NY_0630, new Date('2026-10-28T00:00:00Z'))
    expect(next!.dueAt).toBeInstanceOf(Date)
    expect(next!.dueAt.constructor.name).toBe('Date')
  })
})

describe('localDateInZone', () => {
  it('uses the local calendar date, not the UTC date', () => {
    // 2026-08-08T03:40Z is still Aug 7, 10:40 pm in Chicago. Keying a log entry
    // by the UTC date here silently breaks the streak.
    const late = new Date('2026-08-08T03:40:00Z')
    expect(localDateInZone(late, 'America/Chicago')).toBe('2026-08-07')
    expect(localDateInZone(late, 'UTC')).toBe('2026-08-08')
    expect(localDateInZone(late, 'Pacific/Auckland')).toBe('2026-08-08')
  })

  it('rejects an unknown zone rather than silently falling back to UTC', () => {
    expect(() => localDateInZone(new Date(), 'Mars/Olympus_Mons')).toThrow(RecurrenceError)
  })
})

describe('assertValidSchedule', () => {
  it('accepts the shapes the product actually uses', () => {
    for (const rrule of [
      'FREQ=DAILY',
      'FREQ=DAILY;INTERVAL=3',
      'FREQ=WEEKLY;BYDAY=MO,WE,FR',
      'FREQ=WEEKLY;BYDAY=SA,SU;INTERVAL=2',
      'FREQ=MONTHLY;BYMONTHDAY=1',
      'FREQ=DAILY;BYHOUR=8,20',
      'FREQ=DAILY;UNTIL=20270101T000000Z',
    ]) {
      expect(() => assertValidSchedule({ ...NY_0630, rrule })).not.toThrow()
    }
  })

  it('rejects sub-daily frequencies — one bad rule would flood the cron', () => {
    for (const freq of ['HOURLY', 'MINUTELY', 'SECONDLY']) {
      expect(() => assertValidSchedule({ ...NY_0630, rrule: `FREQ=${freq}` }))
        .toThrow(/not supported/)
    }
  })

  it('rejects an embedded DTSTART or a multi-line rule (ICS injection)', () => {
    expect(() => assertValidSchedule({ ...NY_0630, rrule: 'FREQ=DAILY\nEXDATE:20261101T063000' }))
      .toThrow(/single line/)
    expect(() => assertValidSchedule({ ...NY_0630, rrule: 'DTSTART:20260101T000000Z;FREQ=DAILY' }))
      .toThrow(/must not carry its own DTSTART/)
  })

  it('rejects malformed local time, start date, zone, and missing FREQ', () => {
    expect(() => assertValidSchedule({ ...NY_0630, localTime: '6:30' })).toThrow(/HH:MM/)
    expect(() => assertValidSchedule({ ...NY_0630, localTime: '24:00' })).toThrow(/HH:MM/)
    expect(() => assertValidSchedule({ ...NY_0630, startDate: '10/29/2026' })).toThrow(/YYYY-MM-DD/)
    expect(() => assertValidSchedule({ ...NY_0630, timezone: 'EST5EDT_bogus' })).toThrow(/time zone/)
    expect(() => assertValidSchedule({ ...NY_0630, rrule: 'INTERVAL=2' })).toThrow(/FREQ=/)
  })

  it('rejects a UTC hour masquerading as a zone — the old savings bug', () => {
    // reminder_hour_utc (migration 078) is what this whole module replaces.
    expect(isValidTimeZone('America/New_York')).toBe(true)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone('14')).toBe(false)
  })
})

describe('guards', () => {
  it('caps one expansion regardless of window size', () => {
    const occurrences = expandOccurrences(
      NY_0630, new Date('2026-01-01T00:00:00Z'), new Date('2036-01-01T00:00:00Z'),
    )
    expect(occurrences).toHaveLength(MAX_OCCURRENCES)
  })

  it('rejects an inverted or invalid window', () => {
    expect(() => expandOccurrences(NY_0630, new Date('2026-11-01Z'), new Date('2026-10-01Z')))
      .toThrow(/must not be before/)
    expect(() => expandOccurrences(NY_0630, new Date('nonsense'), new Date()))
      .toThrow(/valid Date/)
  })

  it('returns an empty array for a window with no occurrences', () => {
    expect(isos(NY_0630, '2026-10-29T12:00:00Z', '2026-10-30T09:00:00Z')).toEqual([])
  })
})

describe('icsRuleLines', () => {
  it('emits the local wall clock with a TZID, never a UTC instant', () => {
    expect(icsRuleLines(NY_0630)).toEqual([
      'DTSTART;TZID=America/New_York:20261029T063000',
      'RRULE:FREQ=DAILY',
    ])
  })
})
