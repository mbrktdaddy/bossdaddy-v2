import { describe, it, expect } from 'vitest'
import { assignProductTokens, buildOutline, defaultBlockChoices, validateOutlineShape, type OutlineModelOutput } from '@/lib/content/pipeline/outline'
import type { Brief, OutlinePart } from '@/lib/content/pipeline/types'

const review: Brief = {
  contentType: 'review', productName: 'Battery Daddy', category: 'garage', keyFeatures: [], specs: [], competitors: [],
  imageSlots: 'auto', ratingHint: 7, productSlug: 'battery-daddy',
}
const guide: Brief = {
  contentType: 'guide', topic: 'Garage reset', category: 'garage', pieceType: 'guide', keyPoints: [], productSlugs: ['shelf-a', 'bin-b'],
  imageSlots: 2, inquiryMode: false,
}

function parts(kinds: OutlinePart['kind'][]): OutlinePart[] {
  return kinds.map((kind, i) => ({ kind, heading: kind === 'intro' ? '' : `H${i}`, intent: 'x', notes: [], targetWords: 100, productToken: null }))
}

describe('assignProductTokens', () => {
  it('review with one slug: first body, a middle body, and the closing', () => {
    const out = assignProductTokens(parts(['intro', 'body', 'body', 'body', 'body', 'closing']), review)
    expect(out.map((p) => p.productToken)).toEqual([null, 'battery-daddy', null, 'battery-daddy', null, 'battery-daddy'])
  })
  it('review with two bodies still spreads: first body + second body + closing', () => {
    const out = assignProductTokens(parts(['intro', 'body', 'body', 'closing']), review)
    expect(out.map((p) => p.productToken)).toEqual([null, 'battery-daddy', 'battery-daddy', 'battery-daddy'])
  })
  it('guide: one token per slug across body parts, none in intro/closing', () => {
    const out = assignProductTokens(parts(['intro', 'body', 'body', 'body', 'closing']), guide)
    expect(out.map((p) => p.productToken)).toEqual([null, 'shelf-a', 'bin-b', null, null])
  })
  it('inquiry pieces and slug-less briefs get none', () => {
    const inquiry: Brief = { ...guide, inquiryMode: true }
    expect(assignProductTokens(parts(['intro', 'body', 'closing']), inquiry).every((p) => p.productToken === null)).toBe(true)
    expect(assignProductTokens(parts(['intro', 'body', 'closing']), { ...review, productSlug: undefined }).every((p) => p.productToken === null)).toBe(true)
  })
})

describe('buildOutline', () => {
  const model: OutlineModelOutput = {
    titleOptions: ['DUPLICATE? Battery Daddy review', 'Battery Daddy: 180 cells, one box'],
    excerpt: 'Fine.',
    parts: [
      { kind: 'body', heading: 'Build', intent: 'b', notes: ['Used it four months'], targetWords: 200 },
      { kind: 'intro', heading: '', intent: 'open', notes: [], targetWords: 60 },
      { kind: 'closing', heading: 'Verdict', intent: 'land', notes: [], targetWords: 120 },
    ],
    blocks: { tldr: true, keyTakeaways: true, faqs: false, bestFor: true, notFor: true, prosCons: true },
    imageCount: 5,
  }
  it('puts the intro first and the closing last whatever order the model used', () => {
    const o = buildOutline(model, review, [])
    expect(o.parts.map((p) => p.kind)).toEqual(['intro', 'body', 'closing'])
    expect(o.parts[0].heading).toBe('')
  })
  it('strips the DUPLICATE? marker into a warning and keeps the option', () => {
    const o = buildOutline(model, review, [])
    expect(o.duplicateWarning).toBeTruthy()
    expect(o.titleOptions[0]).toBe('Battery Daddy review')
    expect(o.title).toBe('Battery Daddy review')
  })
  it('a fixed imageSlots overrides the model; auto keeps it', () => {
    expect(buildOutline(model, { ...review, imageSlots: 1 }, []).imageCount).toBe(1)
    expect(buildOutline(model, review, []).imageCount).toBe(5)
  })
  it('reviews always carry the subScores choice; guides never do', () => {
    expect(buildOutline(model, review, []).blocks.subScores).toBe(true)
    expect(buildOutline(model, guide, []).blocks.subScores).toBe(false)
  })
})

describe('defaultBlockChoices', () => {
  it('essays get no blocks, how-tos two, guides three', () => {
    const essay = defaultBlockChoices({ ...guide, pieceType: 'essay' })
    expect(Object.values(essay).some(Boolean)).toBe(false)
    const howto = defaultBlockChoices({ ...guide, pieceType: 'howto' })
    expect([howto.tldr, howto.keyTakeaways, howto.faqs]).toEqual([true, true, false])
    const full = defaultBlockChoices(guide)
    expect([full.tldr, full.keyTakeaways, full.faqs]).toEqual([true, true, true])
  })
})

describe('validateOutlineShape', () => {
  it('requires intro first, closing last, and a body', () => {
    expect(validateOutlineShape([{ kind: 'intro' }, { kind: 'body' }, { kind: 'closing' }])).toBeNull()
    expect(validateOutlineShape([{ kind: 'body' }, { kind: 'closing' }])).toMatch(/intro/)
    expect(validateOutlineShape([{ kind: 'intro' }, { kind: 'body' }])).toMatch(/closing/)
    expect(validateOutlineShape([{ kind: 'intro' }, { kind: 'closing' }])).toMatch(/body/)
  })
})
