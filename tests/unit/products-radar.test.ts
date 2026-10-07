import { describe, it, expect } from 'vitest'
import { isRadarScheduled, isRadarLive, RADAR_TAKE_MAX } from '@/lib/products'
import { ProductCreateSchema, ProductUpdateSchema, productCheckViolation } from '@/lib/products/schema'
import { toRadarItem, radarOutcome, formatSpotted, radarImages } from '@/lib/products/radar'
import { parseVoteIds, requestedByLabel, followChangeForVote, VOTE_IDS_MAX } from '@/lib/wishlist'

describe('productCheckViolation — mig 157 CHECKs → readable 400s', () => {
  const pg = (constraint: string, code = '23514') => ({
    code,
    message: `new row for relation "products" violates check constraint "${constraint}"`,
  })

  it('names the missing take', () => {
    expect(productCheckViolation(pg('products_radar_requires_take'))).toMatch(/needs a take/)
  })

  it('names the length cap', () => {
    expect(productCheckViolation(pg('products_radar_take_length'))).toContain(String(RADAR_TAKE_MAX))
  })

  it('still turns an unknown CHECK into a 400 message', () => {
    expect(productCheckViolation(pg('products_status_check'))).toMatch(/^Invalid product:/)
  })

  it('ignores errors that are not CHECK violations', () => {
    expect(productCheckViolation(pg('products_slug_key', '23505'))).toBeNull()
    expect(productCheckViolation({ message: 'network down' })).toBeNull()
  })
})

describe('isRadarScheduled — spotted_at doubles as the release time', () => {
  const now = Date.parse('2026-10-06T12:00:00Z')

  it('future spotted_at on Radar = scheduled', () => {
    expect(isRadarScheduled({ status: 'radar', spotted_at: '2026-10-07T09:00:00Z' }, now)).toBe(true)
  })

  it('past or present spotted_at = live', () => {
    expect(isRadarScheduled({ status: 'radar', spotted_at: '2026-10-06T12:00:00Z' }, now)).toBe(false)
    expect(isRadarScheduled({ status: 'radar', spotted_at: '2026-10-01T09:00:00Z' }, now)).toBe(false)
  })

  it('a product that left Radar is never scheduled, whatever spotted_at says', () => {
    expect(isRadarScheduled({ status: 'catalog', spotted_at: '2026-10-07T09:00:00Z' }, now)).toBe(false)
  })
})

describe('product schemas — Radar fields', () => {
  const base = { slug: 'cool-thing', name: 'Cool Thing' }

  it('accepts a Radar product with a take and an explicit schedule', () => {
    const r = ProductCreateSchema.safeParse({
      ...base, status: 'radar', radar_take: 'Worth a look.', spotted_at: '2026-10-07T09:00:00.000Z',
    })
    expect(r.success).toBe(true)
  })

  it('caps the take at the DB limit', () => {
    const r = ProductCreateSchema.safeParse({ ...base, status: 'radar', radar_take: 'x'.repeat(RADAR_TAKE_MAX + 1) })
    expect(r.success).toBe(false)
  })

  it('never lets an update null spotted_at (it would break the CHECK or erase the archive date)', () => {
    expect(ProductUpdateSchema.safeParse({ spotted_at: null }).success).toBe(false)
  })
})

describe('isRadarLive — the only state that takes a new vote', () => {
  const now = Date.parse('2026-10-06T12:00:00Z')

  it('live = on Radar and released', () => {
    expect(isRadarLive({ status: 'radar', spotted_at: '2026-10-06T12:00:00Z' }, now)).toBe(true)
    expect(isRadarLive({ status: 'radar', spotted_at: '2026-10-01T09:00:00Z' }, now)).toBe(true)
  })

  it('a scheduled Radar item is not live yet', () => {
    expect(isRadarLive({ status: 'radar', spotted_at: '2026-10-07T09:00:00Z' }, now)).toBe(false)
  })

  it('anything that left Radar, or never had a spotted_at, is closed to new votes', () => {
    for (const status of ['catalog', 'queued', 'testing', 'reviewed', 'passed', 'archived']) {
      expect(isRadarLive({ status, spotted_at: '2026-10-01T09:00:00Z' }, now)).toBe(false)
    }
    expect(isRadarLive({ status: 'radar', spotted_at: null }, now)).toBe(false)
  })
})

describe('toRadarItem — normalising a RADAR_SELECT row', () => {
  const row = {
    id: 'p1', slug: 'cool-thing', name: 'Cool Thing', brand: 'Acme', image_url: null, gallery_images: null, category: 'grilling',
    radar_take: '  Worth a look.  ', spotted_at: '2026-10-01T09:00:00Z', status: 'radar' as const,
    skip_reason: null, affiliate_url: null, store: 'amazon', custom_store_name: null,
    acquisition: null, provided_by: null,
    vote_count: [{ count: 3 }],
    review: null,
  }

  it('flattens the vote count and trims the take', () => {
    const item = toRadarItem(row)
    expect(item.vote_count).toBe(3)
    expect(item.take).toBe('Worth a look.')
  })

  it('builds images from the cover then the gallery, without blanks or duplicates', () => {
    const item = toRadarItem({ ...row, image_url: 'a.jpg', gallery_images: ['b.jpg', 'a.jpg', '', 'b.jpg', 'c.jpg'] })
    expect(item.images).toEqual(['a.jpg', 'b.jpg', 'c.jpg'])
  })

  it('treats a missing count or a blank take as zero / none', () => {
    const item = toRadarItem({ ...row, vote_count: null, radar_take: '   ' })
    expect(item.vote_count).toBe(0)
    expect(item.take).toBeNull()
  })

  it('keeps the review only when it is approved AND visible', () => {
    const approved = { slug: 'cool-thing-review', rating: 9, status: 'approved', is_visible: true }
    expect(toRadarItem({ ...row, review: approved }).review).toEqual({ slug: 'cool-thing-review', rating: 9 })
    expect(toRadarItem({ ...row, review: { ...approved, status: 'draft' } }).review).toBeNull()
    expect(toRadarItem({ ...row, review: { ...approved, is_visible: false } }).review).toBeNull()
  })

  it('tolerates the embed coming back as an array', () => {
    const approved = { slug: 'r', rating: 8, status: 'approved', is_visible: true }
    expect(toRadarItem({ ...row, review: [approved] }).review).toEqual({ slug: 'r', rating: 8 })
    expect(toRadarItem({ ...row, review: [] }).review).toBeNull()
  })
})

describe('radarImages', () => {
  it('handles a missing cover and a null gallery', () => {
    expect(radarImages(null, null)).toEqual([])
    expect(radarImages(null, ['x.jpg'])).toEqual(['x.jpg'])
    expect(radarImages('a.jpg', undefined)).toEqual(['a.jpg'])
  })
})

describe('radarOutcome — where a Radar item went (plan precedence)', () => {
  const base = { slug: 'cool-thing', skip_reason: null, review: null }
  const review = { slug: 'cool-thing-review', rating: 9 }

  it('a live Radar item is live', () => {
    expect(radarOutcome({ ...base, status: 'radar' })).toEqual({ kind: 'live' })
  })

  it('an approved review wins over every stage, so a reviewed product never reads as untested', () => {
    for (const status of ['radar', 'queued', 'testing', 'reviewed', 'passed'] as const) {
      expect(radarOutcome({ ...base, status, review })).toEqual({
        kind: 'reviewed', status: 'reviewed', href: '/reviews/cool-thing-review', rating: 9,
      })
    }
  })

  it('passed shows the reason, then the Bench stages link to the Bench page', () => {
    expect(radarOutcome({ ...base, status: 'passed', skip_reason: ' Too pricey for what it does. ' }))
      .toEqual({ kind: 'passed', status: 'passed', reason: 'Too pricey for what it does.' })
    expect(radarOutcome({ ...base, status: 'passed' })).toEqual({ kind: 'passed', status: 'passed', reason: null })
    expect(radarOutcome({ ...base, status: 'testing' })).toEqual({ kind: 'bench', status: 'testing', href: '/bench/cool-thing' })
    expect(radarOutcome({ ...base, status: 'queued' })).toEqual({ kind: 'bench', status: 'queued', href: '/bench/cool-thing' })
  })

  it('no honest public outcome = null: reviewed with no visible review, catalog, archived', () => {
    expect(radarOutcome({ ...base, status: 'reviewed' })).toBeNull()
    expect(radarOutcome({ ...base, status: 'catalog', review })).toBeNull()
    expect(radarOutcome({ ...base, status: 'archived', review })).toBeNull()
  })
})

describe('formatSpotted — the operator\'s day, not the server\'s', () => {
  it('an evening entry in Chicago stays on its own day even though UTC has rolled over', () => {
    // 2026-10-06 21:30 CDT = 2026-10-07 02:30 UTC
    expect(formatSpotted('2026-10-07T02:30:00Z')).toBe('Oct 6, 2026')
  })
})

describe('vote helpers (lib/wishlist)', () => {
  const a = '0b8f8e9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
  const b = '1b8f8e9e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'

  it('requestedByLabel says the count one way', () => {
    expect(requestedByLabel(1)).toBe('Requested by 1 dad')
    expect(requestedByLabel(3)).toBe('Requested by 3 dads')
  })

  it('parseVoteIds keeps UUIDs only, deduped', () => {
    expect(parseVoteIds(`${a}, ${b},${a},not-an-id,,`)).toEqual([a, b])
    expect(parseVoteIds(null)).toEqual([])
    expect(parseVoteIds("1' or '1'='1")).toEqual([])
  })

  it('parseVoteIds caps a batch at VOTE_IDS_MAX', () => {
    const many = Array.from({ length: VOTE_IDS_MAX + 10 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(parseVoteIds(many.join(','))).toHaveLength(VOTE_IDS_MAX)
  })
})

describe('followChangeForVote — a vote also follows (operator, 2026-10-06)', () => {
  it('casting a vote always follows the item', () => {
    expect(followChangeForVote(true, 'radar')).toBe('follow')
  })

  it('taking a vote back while still on the Radar drops the follow (a withdrawn request never emails)', () => {
    expect(followChangeForVote(false, 'radar')).toBe('unfollow')
  })

  it('once the item has moved on, taking the vote back leaves the follow alone', () => {
    for (const status of ['queued', 'testing', 'reviewed', 'passed', 'catalog', 'archived']) {
      expect(followChangeForVote(false, status)).toBe('none')
    }
    expect(followChangeForVote(false, null)).toBe('none')
  })
})
