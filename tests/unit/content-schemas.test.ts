import { describe, it, expect } from 'vitest'
import { ReviewDraftOutput, ReviewRefineOutput, guideDraftOutput } from '@/lib/content/schemas'

// Regression guard for "jsonSchema() without validate validates nothing": the
// routes now pass Zod schemas, so the SDK actually rejects a bad object.
const section = { heading: 'Build', body: 'Solid.' }
const image = { afterHeading: 'Build', prompt: 'p', altText: 'a', caption: 'c' }
const validReview = {
  title: 'Battery Daddy review', excerpt: 'Fine.', tldr: 'Buy it.', keyTakeaways: ['x'],
  bestFor: ['dads'], notFor: ['nobody'], faqs: [{ question: 'q', answer: 'a' }],
  subScores: { quality: 7, value: 7, ease: 7, dailyUse: 7 }, wouldRebuy: true,
  introduction: 'Intro.', sections: [section], verdict: 'Buy.', pros: ['p'], cons: ['c'],
  imagePrompt: 'hero', inlineImages: [image], suggestedTags: ['garage'],
}

describe('ReviewDraftOutput', () => {
  it('accepts a well-formed draft', () => {
    expect(ReviewDraftOutput.safeParse(validReview).success).toBe(true)
  })
  it('rejects a title over the save limit (120)', () => {
    expect(ReviewDraftOutput.safeParse({ ...validReview, title: 'x'.repeat(121) }).success).toBe(false)
  })
  it('rejects a sub-score outside 1–10 or non-integer', () => {
    expect(ReviewDraftOutput.safeParse({ ...validReview, subScores: { ...validReview.subScores, value: 11 } }).success).toBe(false)
    expect(ReviewDraftOutput.safeParse({ ...validReview, subScores: { ...validReview.subScores, value: 7.5 } }).success).toBe(false)
  })
  it('rejects empty cons (no real cons = no trust)', () => {
    expect(ReviewDraftOutput.safeParse({ ...validReview, cons: [] }).success).toBe(false)
  })
  it('rejects an empty object (the old silent-accept shape)', () => {
    expect(ReviewDraftOutput.safeParse({}).success).toBe(false)
  })
})

describe('guideDraftOutput', () => {
  const base = {
    title: 't', excerpt: 'e', introduction: 'i', sections: [section], conclusion: 'c',
    heroImagePrompt: 'h', inlineImages: [], suggestedTags: [],
  }
  it('essays need no blocks', () => {
    expect(guideDraftOutput('essay').safeParse(base).success).toBe(true)
  })
  it('how-tos require tldr + keyTakeaways but not faqs', () => {
    expect(guideDraftOutput('howto').safeParse(base).success).toBe(false)
    expect(guideDraftOutput('howto').safeParse({ ...base, tldr: 't', keyTakeaways: ['k'] }).success).toBe(true)
  })
  it('guides require all three blocks', () => {
    expect(guideDraftOutput('guide').safeParse({ ...base, tldr: 't', keyTakeaways: ['k'] }).success).toBe(false)
    expect(guideDraftOutput('guide').safeParse({ ...base, tldr: 't', keyTakeaways: ['k'], faqs: [{ question: 'q', answer: 'a' }] }).success).toBe(true)
  })
})

describe('ReviewRefineOutput', () => {
  it('lets the model omit pros/cons/blocks so the author\'s lists survive', () => {
    expect(ReviewRefineOutput.safeParse({
      title: 't', excerpt: 'e', introduction: 'i', sections: [section], verdict: 'v', pros: [], cons: [],
    }).success).toBe(true)
  })
})
