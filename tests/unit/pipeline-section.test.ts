import { describe, it, expect } from 'vitest'
import { nextUnwrittenIndex, priorProse, runToDraftHtml, sectionBudget, sectionPrompt } from '@/lib/content/pipeline/section'
import type { RunState } from '@/lib/content/pipeline/types'

function run(overrides: Partial<RunState> = {}): RunState {
  return {
    id: 'r', userId: 'u', contentType: 'review', status: 'drafting',
    brief: { contentType: 'review', productName: 'Battery Daddy', category: 'garage', keyFeatures: [], specs: [], competitors: [], imageSlots: 'auto', ratingHint: 7, productSlug: 'battery-daddy', howYouUsedIt: 'Four months in the garage' },
    outline: {
      title: 'Battery Daddy review', titleOptions: [], excerpt: 'e', imageCount: 1, related: [], duplicateWarning: null,
      blocks: { tldr: true, keyTakeaways: true, faqs: false, bestFor: false, notFor: false, prosCons: true, subScores: true },
      parts: [
        { kind: 'intro', heading: '', intent: 'open', notes: ['Four months in the garage'], targetWords: 60, productToken: null },
        { kind: 'body', heading: 'Build quality', intent: 'how it holds up', notes: [], targetWords: 200, productToken: 'battery-daddy' },
        { kind: 'closing', heading: 'The Verdict', intent: 'call it', notes: [], targetWords: 120, productToken: 'battery-daddy' },
      ],
    },
    sections: [{ text: 'Intro text.', generationId: null }, null, null],
    blocks: null, critic: null, images: null, contentId: null, costUsd: 0, error: null,
    promptVersion: 'v', createdAt: '', updatedAt: '',
    ...overrides,
  }
}

describe('sectionPrompt', () => {
  it('a part with notes states they are the only firsthand material', () => {
    const p = sectionPrompt(run(), 0)
    expect(p).toContain('the ONLY firsthand material you may claim')
    expect(p).toContain('Four months in the garage')
    expect(p).toContain('part 1 of 3')
  })
  it('a part without notes forbids any usage claim and names its product token', () => {
    const p = sectionPrompt(run(), 1)
    expect(p).toContain('Author facts for this part: none')
    expect(p).toContain('Do NOT claim any usage')
    expect(p).toContain('exactly ONE [[BUY:battery-daddy]] token')
    expect(p).toContain('WRITTEN SO FAR')
    expect(p).toContain('Intro text.')
    expect(p).toContain('← THIS PART')
  })
  it('the closing of a review is told it is the verdict and puts the token at the end', () => {
    const p = sectionPrompt(run(), 2)
    expect(p).toContain('This is the verdict')
    expect(p).toContain('at the very end')
  })
  it('an intro with no firsthand material is told not to invent a scenario', () => {
    const r = run()
    r.brief = { ...r.brief, howYouUsedIt: undefined } as RunState['brief']
    r.outline!.parts[0].notes = []
    expect(sectionPrompt(r, 0)).toContain('No invented scenario')
  })
})

describe('priorProse / nextUnwrittenIndex / runToDraftHtml', () => {
  it('prior prose stops before the current part and carries headings', () => {
    const r = run({ sections: [{ text: 'Intro text.', generationId: null }, { text: 'Body text.', generationId: null }, null] })
    expect(priorProse(r, 2)).toBe('Intro text.\n\n## Build quality\n\nBody text.')
    expect(priorProse(r, 1)).toBe('Intro text.')
    expect(nextUnwrittenIndex(r)).toBe(2)
  })
  it('assembles intro, body sections and the closing into body HTML', () => {
    const r = run({
      sections: [{ text: 'Intro.', generationId: null }, { text: 'A.\n\nB.', generationId: null }, { text: 'Buy it.', generationId: null }],
      images: { heroPrompt: 'h', inline: [{ afterHeading: 'Build quality', prompt: 'p', altText: 'a', caption: 'c' }] },
    })
    const html = runToDraftHtml(r)
    expect(html).toContain('<p>Intro.</p>')
    expect(html).toContain('<h2>Build quality</h2>\n<p>A.</p>\n<p>B.</p>')
    expect(html).toContain('bd-image-placeholder')
    expect(html).toContain('<h2>The Verdict</h2>\n<p>Buy it.</p>')
  })
})

describe('sectionBudget', () => {
  it('scales with the target and stays inside the floor/ceiling', () => {
    expect(sectionBudget(60)).toBe(1500)
    expect(sectionBudget(250)).toBe(1800)
    expect(sectionBudget(600)).toBe(3200)
    expect(sectionBudget(5000)).toBe(6000)
  })
})
