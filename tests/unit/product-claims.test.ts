import { describe, it, expect } from 'vitest'
import { productClaims, acquisitionDisclosure, type Product } from '@/lib/products'
import { withWeeks, formatNoteDate, type TestingNote } from '@/lib/products/testing-notes'
import { ProductCreateSchema, ProductUpdateSchema, TestingNoteCreateSchema } from '@/lib/products/schema'

type ClaimInput = Pick<Product, 'status' | 'acquisition' | 'provided_by' | 'brand'>
const base: ClaimInput = { status: 'catalog', acquisition: null, provided_by: null, brand: 'DeWalt' }

describe('productClaims — claims only when set (brand-guide §1.9)', () => {
  it('a plain showcased product claims nothing', () => {
    for (const status of ['catalog', 'radar', 'passed', 'archived'] as const) {
      expect(productClaims({ ...base, status })).toEqual({ stage: null, bought: false, disclosure: null })
    }
  })

  it('the bench stages and reviewed are stage claims, in the public vocabulary', () => {
    expect(productClaims({ ...base, status: 'queued' }).stage).toEqual({ status: 'queued', label: 'Up Next' })
    expect(productClaims({ ...base, status: 'testing' }).stage).toEqual({ status: 'testing', label: 'Testing Now' })
    expect(productClaims({ ...base, status: 'reviewed' }).stage).toEqual({ status: 'reviewed', label: 'Reviewed' })
  })

  it('"Bought it" only when set, and buying is not a material connection', () => {
    const c = productClaims({ ...base, acquisition: 'purchased' })
    expect(c.bought).toBe(true)
    expect(c.disclosure).toBeNull()
  })
})

describe('acquisitionDisclosure — the legally required line', () => {
  it('names who provided it, falling back to the brand', () => {
    expect(acquisitionDisclosure({ acquisition: 'provided', provided_by: 'Acme PR', brand: 'DeWalt' })).toMatch(/^Acme PR sent me this for testing\./)
    expect(acquisitionDisclosure({ acquisition: 'provided', provided_by: '  ', brand: 'DeWalt' })).toMatch(/^DeWalt sent me this/)
    expect(acquisitionDisclosure({ acquisition: 'provided', provided_by: null, brand: null })).toMatch(/^The brand sent me this/)
  })

  it('says a loaner went back, and always says nobody paid or previewed', () => {
    const line = acquisitionDisclosure({ acquisition: 'loaner', provided_by: null, brand: 'Stihl' })!
    expect(line).toMatch(/^Stihl loaned me this for testing, and it's been sent back\./)
    expect(line).toMatch(/didn't pay for coverage/)
    expect(line).toMatch(/didn't see this before it was published/)
  })

  it('no connection, no line', () => {
    expect(acquisitionDisclosure({ acquisition: null, provided_by: null, brand: 'X' })).toBeNull()
    expect(acquisitionDisclosure({ acquisition: 'purchased', provided_by: null, brand: 'X' })).toBeNull()
  })
})

describe('withWeeks — "Week N" counted from the first note', () => {
  const note = (id: string, noted_on: string, created_at = `${noted_on}T12:00:00Z`): TestingNote =>
    ({ id, product_id: 'p', noted_on, body: id, created_at, updated_at: created_at })

  it('numbers weeks from the earliest note and returns newest first', () => {
    const out = withWeeks([note('a', '2026-09-01'), note('c', '2026-09-15'), note('b', '2026-09-07'), note('d', '2026-09-08')])
    expect(out.map((n) => [n.id, n.week])).toEqual([['c', 3], ['d', 2], ['b', 1], ['a', 1]])
  })

  it('same-day notes keep newest-written first', () => {
    const out = withWeeks([note('early', '2026-09-01', '2026-09-01T08:00:00Z'), note('late', '2026-09-01', '2026-09-01T20:00:00Z')])
    expect(out.map((n) => n.id)).toEqual(['late', 'early'])
  })

  it('empty in, empty out', () => {
    expect(withWeeks([])).toEqual([])
  })

  it('formats the day in UTC so server and browser agree', () => {
    expect(formatNoteDate('2026-10-06')).toBe('Oct 6, 2026')
  })
})

describe('schemas — lifecycle v2 (mig 158)', () => {
  it('a new product defaults to the private catalog stage', () => {
    const r = ProductCreateSchema.parse({ slug: 'x-thing', name: 'X Thing' })
    expect(r.status).toBe('catalog')
  })

  it('considering is retired', () => {
    expect(ProductUpdateSchema.safeParse({ status: 'considering' }).success).toBe(false)
  })

  it('accepts the three acquisitions and clearing back to no claim', () => {
    for (const acquisition of ['purchased', 'provided', 'loaner', null]) {
      expect(ProductUpdateSchema.safeParse({ acquisition }).success).toBe(true)
    }
    expect(ProductUpdateSchema.safeParse({ acquisition: 'gifted' }).success).toBe(false)
  })

  it('testing notes need a date and a non-blank body', () => {
    expect(TestingNoteCreateSchema.safeParse({ noted_on: '2026-10-06', body: 'Week 1 thoughts' }).success).toBe(true)
    expect(TestingNoteCreateSchema.safeParse({ noted_on: '2026-10-06', body: '   ' }).success).toBe(false)
    expect(TestingNoteCreateSchema.safeParse({ noted_on: 'Oct 6', body: 'x' }).success).toBe(false)
  })
})
