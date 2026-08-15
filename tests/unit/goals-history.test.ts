import { describe, it, expect } from 'vitest'
import {
  buildHistoryGrid, buildTrendSeries, trendExtent,
  gridWindow, weekStart, weekdayIndex, summarizeGrid,
  monthOf, addMonths, monthGridWindow, WEEKDAY_INITIALS,
} from '@/lib/goals/history'
import { computeScheduledStreak, type EntryLike, type OccurrenceLike } from '@/lib/goals/progress'

// The grid must not have its own opinion about whether a day was kept — it calls
// the same classifier the streak walks and only adds detail inside the states that
// classifier collapses. The last test in the first block is the one that matters:
// it asserts the picture and the number agree.
//
// 2026-08-03 is a Monday.

const occ = (local_date: string, status = 'completed', target_value: number | null = null):
  OccurrenceLike => ({ local_date, status, target_value })
const done = (local_date: string, value: number | null = null): EntryLike =>
  ({ local_date, kind: 'completed', value })

describe('buildHistoryGrid', () => {
  const window = { fromYmd: '2026-08-03', toYmd: '2026-08-09' }

  it('returns one cell per calendar date, inclusive of both ends', () => {
    const cells = buildHistoryGrid({ occurrences: [], entries: [], ...window })
    expect(cells).toHaveLength(7)
    expect(cells[0].date).toBe('2026-08-03')
    expect(cells[6].date).toBe('2026-08-09')
  })

  it('marks an unscheduled day as nothing due, not as a miss', () => {
    // A Tuesday on a MO/WE/FR plan is not a gap in anything.
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-03')], entries: [done('2026-08-03')], ...window,
    })
    expect(cells[0].state).toBe('kept')
    expect(cells[1].state).toBe('none')
  })

  it('splits the streak\'s "broken" into skipped and missed', () => {
    // Both end a run identically and are very different things to look back at.
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-03', 'missed'), occ('2026-08-04', 'skipped')],
      entries: [{ local_date: '2026-08-04', kind: 'skipped', value: null }],
      ...window,
    })
    expect(cells[0].state).toBe('missed')
    expect(cells[1].state).toBe('skipped')
  })

  it('marks an off-day log as an extra, never as a kept scheduled day', () => {
    // It's a vote and it counts in kept_total, but it does not extend the chain —
    // so the grid must not draw it as though it were part of the run.
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-03')],
      entries: [done('2026-08-03'), done('2026-08-04')],
      ...window,
    })
    expect(cells[0].state).toBe('kept')
    expect(cells[1].state).toBe('extra')
  })

  it('shows a future scheduled day as open', () => {
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-09', 'pending')], entries: [], ...window,
    })
    expect(cells[6].state).toBe('open')
  })

  it('carries the logged value and the STAMPED target', () => {
    // occurrence.target_value is what the plan asked for that day. Re-deriving the
    // curve at read time would redraw the past whenever the end date moved.
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-03', 'completed', 18)],
      entries: [done('2026-08-03', 19)],
      ...window,
    })
    expect(cells[0].value).toBe(19)
    expect(cells[0].target).toBe(18)
  })

  it('agrees with the streak about which days were kept', () => {
    // THE REGRESSION GUARD. If someone re-implements "was this kept?" here, the two
    // numbers on the page start disagreeing about the same day.
    const occurrences = ['2026-08-03', '2026-08-05', '2026-08-07'].map((d) => occ(d))
    const entries = ['2026-08-03', '2026-08-05', '2026-08-07'].map((d) => done(d))
    const cells = buildHistoryGrid({ occurrences, entries, ...window })
    const kept = cells.filter((c) => c.state === 'kept').length
    expect(kept).toBe(3)
    expect(computeScheduledStreak(occurrences, entries)).toBe(3)
  })
})

describe('summarizeGrid', () => {
  it('counts every state, so the text summary can stand in for the picture', () => {
    const cells = buildHistoryGrid({
      occurrences: [occ('2026-08-03'), occ('2026-08-04', 'missed'), occ('2026-08-05', 'pending')],
      entries: [done('2026-08-03')],
      fromYmd: '2026-08-03', toYmd: '2026-08-05',
    })
    expect(summarizeGrid(cells)).toMatchObject({ kept: 1, missed: 1, open: 1 })
  })
})

describe('weekdayIndex / weekStart / gridWindow', () => {
  // Weeks are displayed Sunday-first (WEEK_STARTS_ON = 0) to match a wall calendar.
  // This is display only — DAY_TOKENS in schedule-input.ts stays Monday-first
  // because RFC 5545's WKST=MO decides which days an INTERVAL>1 weekly rule groups
  // into a week, and changing that would move people's reminders.
  it('puts Sunday in the first column', () => {
    expect(weekdayIndex('2026-08-09')).toBe(0)   // Sunday
    expect(weekdayIndex('2026-08-03')).toBe(1)   // Monday
    expect(weekdayIndex('2026-08-08')).toBe(6)   // Saturday
  })

  it('agrees with WEEKDAY_INITIALS about which column is which', () => {
    // The header and the cells are laid out from the same constant, so a date's
    // column index must select its own initial. This is the drift that once made a
    // grid's labels imply the opposite axis.
    expect(WEEKDAY_INITIALS).toHaveLength(7)
    expect(WEEKDAY_INITIALS[weekdayIndex('2026-08-09')!]).toBe('S')   // Sunday
    expect(WEEKDAY_INITIALS[weekdayIndex('2026-08-05')!]).toBe('W')   // Wednesday
    expect(WEEKDAY_INITIALS[weekdayIndex('2026-08-06')!]).toBe('T')   // Thursday
  })

  it('snaps any day back to its Sunday', () => {
    expect(weekStart('2026-08-06')).toBe('2026-08-02')   // Thursday → Sunday
    expect(weekStart('2026-08-02')).toBe('2026-08-02')   // already Sunday
    expect(weekStart('2026-08-08')).toBe('2026-08-02')   // Saturday, same week
    expect(weekStart('2026-08-09')).toBe('2026-08-09')   // next Sunday, next week
  })

  it('spans whole weeks so the grid is rectangular', () => {
    const w = gridWindow('2026-08-06', 12)!
    expect(w.to).toBe('2026-08-08')                    // Saturday of this week
    expect(w.from).toBe('2026-05-17')                  // 11 weeks earlier, a Sunday
    expect(weekdayIndex(w.from)).toBe(0)
    expect(weekdayIndex(w.to)).toBe(6)
    const cells = buildHistoryGrid({
      occurrences: [], entries: [], fromYmd: w.from, toYmd: w.to,
    })
    expect(cells).toHaveLength(84)                     // 12 × 7, no partial row
  })

  it('returns null on a malformed date rather than a sheared grid', () => {
    expect(weekdayIndex('nope')).toBeNull()
    expect(gridWindow('nope', 12)).toBeNull()
  })
})

describe('monthOf / addMonths / monthGridWindow', () => {
  it('rolls the year over in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-08', 0)).toBe('2026-08')
  })

  it('pads a month out to whole weeks', () => {
    // August 2026 starts on a Saturday and ends on a Monday, so the calendar needs
    // days from July at the front and September at the back — a ragged first row
    // stops reading as a calendar.
    const w = monthGridWindow('2026-08')!
    expect(w.from).toBe('2026-07-26')            // the Sunday before Aug 1 (a Sat)
    expect(w.to).toBe('2026-09-05')              // the Saturday after Aug 31 (a Mon)
    expect(weekdayIndex(w.from)).toBe(0)
    expect(weekdayIndex(w.to)).toBe(6)
    const cells = buildHistoryGrid({
      occurrences: [], entries: [], fromYmd: w.from, toYmd: w.to,
    })
    expect(cells.length % 7).toBe(0)             // rectangular, always
  })

  it('adds no padding to a month that already starts on the first column', () => {
    // February 2026 starts on a Sunday, so there is nothing to pad at the front.
    expect(weekdayIndex('2026-02-01')).toBe(0)
    expect(monthGridWindow('2026-02')!.from).toBe('2026-02-01')
  })

  it('handles February in a leap year', () => {
    const w = monthGridWindow('2028-02')!
    const cells = buildHistoryGrid({
      occurrences: [], entries: [], fromYmd: w.from, toYmd: w.to,
    })
    // Feb 29 exists and has to be inside the window.
    expect(cells.some((c) => c.date === '2028-02-29')).toBe(true)
  })

  it('returns null on malformed input rather than a broken calendar', () => {
    expect(monthOf('nope')).toBeNull()
    expect(addMonths('2026-13-01', 1)).toBeNull()
    expect(monthGridWindow('2026-8')).toBeNull()
    expect(monthOf('2026-08-15')).toBe('2026-08')
  })
})

describe('buildTrendSeries / trendExtent', () => {
  const cells = buildHistoryGrid({
    occurrences: [
      occ('2026-08-03', 'completed', 198),
      occ('2026-08-05', 'completed', 196),
      occ('2026-08-07', 'pending', 194),
    ],
    entries: [done('2026-08-03', 198), done('2026-08-05', 195)],
    fromYmd: '2026-08-03', toYmd: '2026-08-09',
  })

  it('drops days with neither a reading nor a target', () => {
    // A weekly weigh-in must not become eighty-three empty days with one dot.
    expect(buildTrendSeries(cells).map((p) => p.date))
      .toEqual(['2026-08-03', '2026-08-05', '2026-08-07'])
  })

  it('spans both series on ONE scale', () => {
    // Both are the same measure, so they share an axis. A second scale would invent
    // a correlation out of wherever the two happened to line up.
    expect(trendExtent(buildTrendSeries(cells))).toEqual({ min: 194, max: 198 })
  })

  it('gives a flat series a band instead of dividing by zero', () => {
    const flat = buildTrendSeries(buildHistoryGrid({
      occurrences: [], entries: [done('2026-08-03', 180), done('2026-08-04', 180)],
      fromYmd: '2026-08-03', toYmd: '2026-08-04',
    }))
    expect(trendExtent(flat)).toEqual({ min: 179, max: 181 })
  })

  it('returns null with nothing to plot', () => {
    expect(trendExtent([])).toBeNull()
  })
})
