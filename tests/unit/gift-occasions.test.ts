import { describe, it, expect } from 'vitest'
import { isGiftSeason, getSeasonalOccasions } from '@/lib/gift-occasions'

// Local-time constructor on purpose: isGiftSeason reads getMonth/getDate in
// the server's local clock, so the edges must be built the same way.
const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12)

describe('isGiftSeason — 1 Oct through 26 Dec, inclusive (Phase I-6)', () => {
  it.each([
    [local(2026, 9, 30),  false],
    [local(2026, 10, 1),  true],
    [local(2026, 10, 8),  true],
    [local(2026, 11, 27), true],
    [local(2026, 12, 26), true],
    [local(2026, 12, 27), false],
    [local(2026, 12, 31), false],
    [local(2027, 1, 1),   false],
    [local(2026, 6, 15),  false],
  ])('%s → %s', (date, expected) => {
    expect(isGiftSeason(date)).toBe(expected)
  })

  it('defaults to today without throwing', () => {
    expect(typeof isGiftSeason()).toBe('boolean')
  })
})

describe('getSeasonalOccasions', () => {
  it('leads with Christmas in December', () => {
    expect(getSeasonalOccasions(local(2026, 12, 5))[0].value).toBe('christmas')
  })
  it('returns six occasions in every season', () => {
    for (const m of [1, 4, 7, 10]) expect(getSeasonalOccasions(local(2026, m, 15))).toHaveLength(6)
  })
})
