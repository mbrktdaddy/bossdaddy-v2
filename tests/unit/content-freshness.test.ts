import { describe, it, expect } from 'vitest'
import {
  computeFreshnessFlags, intentFromPreset,
  GUIDE_STALE_DAYS, REVIEW_STALE_DAYS,
  type GuideFreshnessInput, type ReviewFreshnessInput,
} from '@/lib/content/freshness'

// The weekly sweep's rules. Dates are built relative to a fixed `now` so the
// tests never drift with the calendar.

const NOW = new Date('2026-10-23T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()
const daysAhead = (n: number) => daysAgo(-n)

function review(over: Partial<ReviewFreshnessInput> = {}): ReviewFreshnessInput {
  return {
    id: 'r1', published_at: daysAgo(10), followup_intent_at: null, last_verified_at: null,
    product_slug: null, latest_followup_at: null, ...over,
  }
}
function guide(over: Partial<GuideFreshnessInput> = {}): GuideFreshnessInput {
  return { id: 'g1', published_at: daysAgo(10), updated_at: daysAgo(10), followup_intent_at: null, last_verified_at: null, ...over }
}
const run = (reviews: ReviewFreshnessInput[] = [], guides: GuideFreshnessInput[] = [], products: { slug: string; name: string; status: string }[] = []) =>
  computeFreshnessFlags({ reviews, guides, products, now: NOW })

describe('followup-due', () => {
  it('flags a passed intent with nothing verified since', () => {
    const flags = run([review({ followup_intent_at: daysAgo(3) })])
    expect(flags).toEqual([expect.objectContaining({ contentType: 'review', contentId: 'r1', reason: 'followup-due' })])
    expect(flags[0].detail).toMatch(/3 days overdue/)
  })

  it('is cleared by a verification at or after the intent date', () => {
    expect(run([review({ followup_intent_at: daysAgo(3), last_verified_at: daysAgo(1) })])).toEqual([])
    // Verified BEFORE the intent date doesn't count — the plan was to look again later.
    expect(run([review({ followup_intent_at: daysAgo(3), last_verified_at: daysAgo(20) })])).toHaveLength(1)
  })

  it('does not fire for an intent still in the future', () => {
    expect(run([review({ followup_intent_at: daysAhead(5) })])).toEqual([])
  })

  it('applies to guides the same way', () => {
    const flags = run([], [guide({ followup_intent_at: daysAgo(1) })])
    expect(flags).toEqual([expect.objectContaining({ contentType: 'guide', reason: 'followup-due' })])
  })
})

describe('product-unavailable', () => {
  it('flags a review whose product is archived', () => {
    const flags = run([review({ product_slug: 'x' })], [], [{ slug: 'x', name: 'Thing', status: 'archived' }])
    expect(flags).toEqual([expect.objectContaining({ reason: 'product-unavailable', detail: 'Thing is archived in the catalog' })])
  })

  it('ignores live and unknown products', () => {
    expect(run([review({ product_slug: 'x' })], [], [{ slug: 'x', name: 'Thing', status: 'reviewed' }])).toEqual([])
    expect(run([review({ product_slug: 'missing' })], [], [])).toEqual([])
  })
})

describe('stale (the heuristic, only when no intent is set)', () => {
  it('flags a review past the window with no follow-up or verify', () => {
    const flags = run([review({ published_at: daysAgo(REVIEW_STALE_DAYS) })])
    expect(flags).toEqual([expect.objectContaining({ reason: 'stale' })])
    expect(run([review({ published_at: daysAgo(REVIEW_STALE_DAYS - 1) })])).toEqual([])
  })

  it('counts a follow-up or a verification as fresh', () => {
    expect(run([review({ published_at: daysAgo(400), latest_followup_at: daysAgo(20) })])).toEqual([])
    expect(run([review({ published_at: daysAgo(400), last_verified_at: daysAgo(20) })])).toEqual([])
  })

  it('never fires when an intent is set — the author has a plan', () => {
    expect(run([review({ published_at: daysAgo(400), followup_intent_at: daysAhead(30) })])).toEqual([])
    // A passed intent is "due", not "stale": one flag, not two.
    const flags = run([review({ published_at: daysAgo(400), followup_intent_at: daysAgo(30) })])
    expect(flags.map((f) => f.reason)).toEqual(['followup-due'])
  })

  it('uses the 12-month window and the edit date for guides', () => {
    expect(run([], [guide({ published_at: daysAgo(400), updated_at: daysAgo(400) })])).toEqual([expect.objectContaining({ contentType: 'guide', reason: 'stale' })])
    expect(run([], [guide({ published_at: daysAgo(400), updated_at: daysAgo(GUIDE_STALE_DAYS - 1) })])).toEqual([])
  })

  it('skips items with no publish date', () => {
    expect(run([review({ published_at: null })], [guide({ published_at: null, updated_at: null })])).toEqual([])
  })
})

describe('intentFromPreset', () => {
  it('lands at midday UTC the right number of days out', () => {
    expect(intentFromPreset('30d', NOW)).toBe('2026-11-22T12:00:00.000Z')
    expect(intentFromPreset('1yr', NOW)).toBe('2027-10-23T12:00:00.000Z')
  })
})
