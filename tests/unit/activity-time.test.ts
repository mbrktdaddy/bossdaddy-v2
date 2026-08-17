// The conversation/notification list timestamp. Worth testing because the format
// ESCALATES across four bands and the boundaries are where it goes wrong: an
// hours-based threshold makes "6 days ago at 11pm" and "6 days ago at 1am" render
// differently, and a weekday name past a week is ambiguous ("Tue" — this one or
// last one?). `now` is injectable precisely so these can be pinned.

import { describe, it, expect } from 'vitest'
import { activityTime } from '@/lib/activity-time'

// A Thursday, mid-afternoon, so "yesterday" and "last week" don't straddle a
// month or year boundary by accident.
const NOW = new Date('2026-08-13T15:30:00')

describe('activityTime', () => {
  it('shows a clock time for today', () => {
    const out = activityTime(new Date('2026-08-13T09:05:00').toISOString(), NOW)
    // Locale decides 24h vs am/pm, so assert the shape rather than the string.
    expect(out).toMatch(/\d{1,2}:\d{2}/)
  })

  // Two minutes past midnight is still "today" even though it's 15 hours back,
  // and 11:50pm last night is "Yesterday" even though it's under two hours back.
  // Calendar day, not elapsed time — this is the pair that catches a naive diff.
  it('uses the calendar day, not elapsed hours', () => {
    expect(activityTime(new Date('2026-08-13T00:02:00').toISOString(), NOW)).toMatch(/\d{1,2}:\d{2}/)
    expect(activityTime(new Date('2026-08-12T23:50:00').toISOString(), NOW)).toBe('Yesterday')
  })

  it('names yesterday', () => {
    expect(activityTime(new Date('2026-08-12T10:00:00').toISOString(), NOW)).toBe('Yesterday')
  })

  it('uses a weekday name inside the last week', () => {
    // 2026-08-10 is the Monday before that Thursday.
    expect(activityTime(new Date('2026-08-10T10:00:00').toISOString(), NOW)).toBe('Mon')
  })

  // Both ends of the weekday band, since 7 is where it has to flip to a date or
  // the name becomes ambiguous.
  it('flips to a date at a week old', () => {
    const sixDays = activityTime(new Date('2026-08-07T10:00:00').toISOString(), NOW)
    const sevenDays = activityTime(new Date('2026-08-06T10:00:00').toISOString(), NOW)
    expect(sixDays).toMatch(/^[A-Za-z]{3}$/)
    expect(sevenDays).toMatch(/\d/)
    expect(sevenDays).not.toMatch(/^[A-Za-z]{3}$/)
  })

  it('shows month and day beyond a week, with no year in the same year', () => {
    const out = activityTime(new Date('2026-06-02T10:00:00').toISOString(), NOW)
    expect(out).toMatch(/\d/)
    expect(out).not.toContain('2026')
  })

  it('adds the year once it is a different one', () => {
    expect(activityTime(new Date('2025-11-02T10:00:00').toISOString(), NOW)).toContain('2025')
  })

  // A malformed timestamp must render as nothing, not "Invalid Date" — this text
  // sits in a conversation row where a thrown error would blank the whole list.
  it('renders nothing for an unparseable value', () => {
    expect(activityTime('not-a-date', NOW)).toBe('')
    expect(activityTime('', NOW)).toBe('')
  })

  // A clock-skewed client (or a row written a second in the future) must not fall
  // through to the weekday branch, which would read as six days old.
  it('treats a future timestamp on the same day as today', () => {
    expect(activityTime(new Date('2026-08-13T23:00:00').toISOString(), NOW)).toMatch(/\d{1,2}:\d{2}/)
  })
})
