import { describe, it, expect } from 'vitest'
import { runRules } from '@/lib/content/pipeline/critic/rules'
import type { Brief, OutlinePart } from '@/lib/content/pipeline/types'

const review: Brief = { contentType: 'review', productName: 'X', category: 'garage', keyFeatures: [], specs: [], competitors: [], imageSlots: 0, ratingHint: 7, productSlug: 'x-slug' }
// Tiny targets so the length rule stays quiet on these one-line fixtures.
const parts: OutlinePart[] = [
  { kind: 'intro', heading: '', intent: 'i', notes: [], targetWords: 10, productToken: null },
  { kind: 'body', heading: 'Build', intent: 'b', notes: [], targetWords: 10, productToken: 'x-slug' },
  { kind: 'closing', heading: 'The Verdict', intent: 'v', notes: [], targetWords: 10, productToken: 'x-slug' },
]
const clean = [
  'Here is the deal: this box holds 180 cells.',
  'The latches feel cheap but the tester works. [[BUY:x-slug]]',
  'Buy it if your garage is a mess. [[BUY:x-slug]]',
]
const codes = (f: ReturnType<typeof runRules>) => f.map((x) => x.code)

describe('runRules', () => {
  it('passes clean prose with the expected tokens', () => {
    expect(runRules({ brief: review, parts, texts: clean, familyNames: ['Avery'] })).toEqual([])
  })
  it('blocks a family member name', () => {
    const f = runRules({ brief: review, parts, texts: ['My daughter Avery grabbed it.', clean[1], clean[2]], familyNames: ['Avery'] })
    expect(f[0]).toMatchObject({ severity: 'block', code: 'family-name', part: 0 })
  })
  it('flags hype, corporate, sponsored and soft-parenting tells with the right severity', () => {
    const texts = ['A revolutionary box. We leverage it daily, in partnership with nobody. Every child is unique.', clean[1], clean[2]]
    const f = runRules({ brief: review, parts, texts, familyNames: [] })
    expect(codes(f)).toEqual(expect.arrayContaining(['hype', 'corporate', 'sponsored-phrasing', 'soft-parenting']))
    expect(f.find((x) => x.code === 'sponsored-phrasing')?.severity).toBe('block')
    expect(f.find((x) => x.code === 'hype')?.severity).toBe('warn')
  })
  it('flags the brand used as a greeting', () => {
    const f = runRules({ brief: review, parts, texts: ['Hey boss dads, listen.', clean[1], clean[2]], familyNames: [] })
    expect(codes(f)).toContain('brand-greeting')
  })
  it('counts product tokens exactly as assigned', () => {
    const missing = runRules({ brief: review, parts, texts: [clean[0], 'No token here.', clean[2]], familyNames: [] })
    expect(missing.find((x) => x.code === 'product-token')?.message).toMatch(/found 0/)
    const stray = runRules({ brief: review, parts, texts: ['[[BUY:x-slug]] in the intro.', clean[1], clean[2]], familyNames: [] })
    expect(stray.some((x) => x.code === 'product-token' && x.part === 0)).toBe(true)
    const unknown = runRules({ brief: review, parts, texts: [clean[0], clean[1] + ' [[BUY:other]]', clean[2]], familyNames: [] })
    expect(unknown.some((x) => x.message.includes("isn't linked"))).toBe(true)
  })
  it('blocks raw URLs', () => {
    const f = runRules({ brief: review, parts, texts: [clean[0], clean[1] + ' https://amazon.com/x', clean[2]], familyNames: [] })
    expect(codes(f)).toContain('raw-url')
  })
  it('hedges are a note outside the inquiry register and ignored inside it', () => {
    const texts = ['It may work. It might not. It could.', clean[1], clean[2]]
    expect(codes(runRules({ brief: review, parts, texts, familyNames: [] }))).toContain('hedge-words')
    const inquiry: Brief = { contentType: 'guide', topic: 't', category: 'table-duty', pieceType: 'essay', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: true }
    const noTokens = parts.map((p) => ({ ...p, productToken: null }))
    const plain = texts.map((t) => t.replace(/\s*\[\[BUY:[^\]]+\]\]/g, ''))
    expect(codes(runRules({ brief: inquiry, parts: noTokens, texts: plain, familyNames: [] }))).not.toContain('hedge-words')
  })
  it('notes a part far over its target length', () => {
    const long = Array.from({ length: 400 }, () => 'word').join(' ') + ' [[BUY:x-slug]]'
    const f = runRules({ brief: review, parts, texts: [clean[0], long, clean[2]], familyNames: [] })
    expect(f.some((x) => x.code === 'over-length' && x.part === 1)).toBe(true)
  })
})
