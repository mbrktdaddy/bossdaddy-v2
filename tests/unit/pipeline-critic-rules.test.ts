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
  it('hedges are a note outside the inquiry register and tolerated inside it, except in the closing', () => {
    const texts = ['It may work. It might not. It could.', clean[1], clean[2]]
    expect(codes(runRules({ brief: review, parts, texts, familyNames: [] }))).toContain('hedge-words')
    const inquiry: Brief = { contentType: 'guide', topic: 't', category: 'table-duty', pieceType: 'essay', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: true }
    const noTokens = parts.map((p) => ({ ...p, productToken: null }))
    const plain = texts.map((t) => t.replace(/\s*\[\[BUY:[^\]]+\]\]/g, ''))
    // Three hedges in a non-closing part: slack inside the register.
    expect(codes(runRules({ brief: inquiry, parts: noTokens, texts: plain, familyNames: [] }))).not.toContain('hedge-words')
    // Four in one part: still a note.
    const four = ['It may work. It might not. It could. It may.', plain[1], plain[2]]
    expect(runRules({ brief: inquiry, parts: noTokens, texts: four, familyNames: [] }).find((x) => x.code === 'hedge-words')?.severity).toBe('note')
    // Two in the closing: a warn — the position is a conviction, not a maybe.
    const hedgedClose = [plain[0].replace(/may|might|could/g, 'will'), plain[1], 'It may be right. It might be wrong.']
    expect(runRules({ brief: inquiry, parts: noTokens, texts: hedgedClose, familyNames: [] }).find((x) => x.code === 'hedge-words')?.severity).toBe('warn')
  })
  it('inquiry register: a shrug blocks in the closing and warns elsewhere; a closing question is a note', () => {
    const inquiry: Brief = { contentType: 'guide', topic: 't', category: 'table-duty', pieceType: 'essay', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: true }
    const noTokens = parts.map((p) => ({ ...p, productToken: null }))
    const shrugClose = ['Here is the question.', 'Here is the argument.', "In the end it's up to each dad."]
    expect(runRules({ brief: inquiry, parts: noTokens, texts: shrugClose, familyNames: [] }).find((x) => x.code === 'inquiry-shrug')?.severity).toBe('block')
    const shrugBody = ['Here is the question.', 'Some say there is no right answer here.', 'I land on presence.']
    expect(runRules({ brief: inquiry, parts: noTokens, texts: shrugBody, familyNames: [] }).find((x) => x.code === 'inquiry-shrug')?.severity).toBe('warn')
    const question = ['Here is the question.', 'Here is the argument.', 'I land on presence. What will you do with yours?']
    expect(codes(runRules({ brief: inquiry, parts: noTokens, texts: question, familyNames: [] }))).toContain('closing-question')
    // Outside the register none of these fire.
    expect(codes(runRules({ brief: review, parts, texts: [clean[0], clean[1], "It's up to each dad. [[BUY:x-slug]]"], familyNames: [] }))).not.toContain('inquiry-shrug')
  })
  it('notes scripture in a gear piece, never in the inquiry register', () => {
    const verse = [clean[0], 'Ephesians 2:8 says it plainly. [[BUY:x-slug]]', clean[2]]
    expect(codes(runRules({ brief: review, parts, texts: verse, familyNames: [] }))).toContain('scripture-in-gear')
    const inquiry: Brief = { contentType: 'guide', topic: 't', category: 'table-duty', pieceType: 'essay', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: true }
    const noTokens = parts.map((p) => ({ ...p, productToken: null }))
    expect(codes(runRules({ brief: inquiry, parts: noTokens, texts: ['Q.', 'Ephesians 2:8 says it plainly.', 'I land here.'], familyNames: [] }))).not.toContain('scripture-in-gear')
  })
  it('notes a part far over its target length', () => {
    const long = Array.from({ length: 400 }, () => 'word').join(' ') + ' [[BUY:x-slug]]'
    const f = runRules({ brief: review, parts, texts: [clean[0], long, clean[2]], familyNames: [] })
    expect(f.some((x) => x.code === 'over-length' && x.part === 1)).toBe(true)
  })
})

describe('runRules — structure (lane 1)', () => {
  const essay: Brief = { contentType: 'guide', topic: 'T', category: 'faith', pieceType: 'essay', keyPoints: [], productSlugs: [], imageSlots: 0, inquiryMode: false }
  const noTokenParts: OutlinePart[] = parts.map((p) => ({ ...p, productToken: null }))
  const noTokens = [clean[0], 'The latches feel cheap but the tester works.', 'Buy it if your garage is a mess.']

  it('blocks a # / ## heading inside a part', () => {
    const f = runRules({ brief: review, parts, texts: [clean[0], '## Build\n' + clean[1], clean[2]], familyNames: [] })
    expect(f.find((x) => x.code === 'heading-in-part')).toMatchObject({ severity: 'block', part: 1 })
  })
  it('warns on a list inside an essay', () => {
    const f = runRules({ brief: essay, parts: noTokenParts, texts: [noTokens[0], 'Three things:\n- one\n- two', noTokens[2]], familyNames: [] })
    expect(f.find((x) => x.code === 'list-in-essay')).toMatchObject({ severity: 'warn', part: 1 })
  })
  it('notes a list-heavy part only when the outline did not ask for a list', () => {
    const texts = [noTokens[0], 'Lead.\n- one\n- two\n- three', noTokens[2]]
    const prose = runRules({ brief: review, parts: noTokenParts, texts, familyNames: [] })
    expect(prose.find((x) => x.code === 'list-heavy')).toMatchObject({ part: 1 })
    const listed = noTokenParts.map((p, i) => (i === 1 ? { ...p, format: 'list' as const } : p))
    expect(codes(runRules({ brief: review, parts: listed, texts, familyNames: [] }))).not.toContain('list-heavy')
  })
  it('notes more than one pull-quote across the piece', () => {
    const f = runRules({ brief: review, parts: noTokenParts, texts: ['> One.\n\nProse.', '> Two.\n\nMore prose.', noTokens[2]], familyNames: [] })
    expect(f.find((x) => x.code === 'pullquote-count')?.message).toMatch(/^2 pull-quote/)
    expect(codes(runRules({ brief: review, parts: noTokenParts, texts: ['> One.\n\nProse.', noTokens[1], noTokens[2]], familyNames: [] }))).not.toContain('pullquote-count')
  })
  it('notes when steps were asked for and none (or only bullets) were written', () => {
    const steps = noTokenParts.map((p, i) => (i === 1 ? { ...p, format: 'steps' as const } : p))
    const none = runRules({ brief: review, parts: steps, texts: noTokens, familyNames: [] })
    expect(none.find((x) => x.code === 'format-missing')?.message).toMatch(/numbered steps/)
    const bullets = runRules({ brief: review, parts: steps, texts: [noTokens[0], 'Go:\n- a\n- b', noTokens[2]], familyNames: [] })
    expect(bullets.find((x) => x.code === 'format-missing')?.message).toMatch(/numbered list, not bullets/)
    const numbered = runRules({ brief: review, parts: steps, texts: [noTokens[0], 'Go:\n1. a\n2. b', noTokens[2]], familyNames: [] })
    expect(codes(numbered)).not.toContain('format-missing')
  })
})
