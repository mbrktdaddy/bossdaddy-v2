import { describe, it, expect } from 'vitest'
import { isRadarScheduled, RADAR_TAKE_MAX } from '@/lib/products'
import { ProductCreateSchema, ProductUpdateSchema, productCheckViolation } from '@/lib/products/schema'

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
