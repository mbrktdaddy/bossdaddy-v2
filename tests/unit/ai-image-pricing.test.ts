import { describe, it, expect } from 'vitest'
import { estimateImageCostUsd } from '@/lib/ai/pricing'
import { IMAGE_TIERS, PINNED_IMAGE_MODELS, tierFor } from '@/lib/images/tiers'

// Image generations land on the piece's cost chip (generations stage 'image').
// The live pins (gpt-image-2.5 Sunburst + Flare) and plain gpt-image-2 are priced
// from OpenAI's pricing page as read on 2026-10-31; the retired gpt-image-1, 1.5
// and 1-mini rows (Standard list prices, 2026-10-23) stay so historical
// `generations` rows still price. Anything unknown is null, never a guess.

const usage = {
  input_tokens: 1_100,
  input_tokens_details: { text_tokens: 100, image_tokens: 1_000 },
  output_tokens: 4_000,
}

describe('estimateImageCostUsd', () => {
  it('prices the Publication pin (gpt-image-2.5-sunburst) per token class', () => {
    // 100/1e6*5 + 1000/1e6*8 + 4000/1e6*30 = 0.0005 + 0.008 + 0.12
    expect(estimateImageCostUsd('openai/gpt-image-2.5-sunburst', usage)).toBeCloseTo(0.1285, 5)
  })

  it('prices the Draft pin (gpt-image-2.5-flare) at the same token rates', () => {
    expect(estimateImageCostUsd('openai/gpt-image-2.5-flare', usage)).toBeCloseTo(0.1285, 5)
  })

  it('prices gpt-image-2 at the same token rates as 2.5', () => {
    expect(estimateImageCostUsd('openai/gpt-image-2', usage)).toBeCloseTo(0.1285, 5)
  })

  it('has a price row for every model the tiers pin, so a bump cannot silently log null costs', () => {
    for (const model of PINNED_IMAGE_MODELS) {
      expect(estimateImageCostUsd(`openai/${model}`, usage), model).not.toBeNull()
    }
  })

  it('still prices retired gpt-image-1 so historical rows keep their cost', () => {
    // 100/1e6*5 + 1000/1e6*10 + 4000/1e6*40 = 0.0005 + 0.01 + 0.16
    expect(estimateImageCostUsd('openai/gpt-image-1', usage)).toBeCloseTo(0.1705, 5)
  })

  it('still prices retired gpt-image-1.5', () => {
    // 100/1e6*5 + 1000/1e6*8 + 4000/1e6*32 = 0.0005 + 0.008 + 0.128
    expect(estimateImageCostUsd('openai/gpt-image-1.5', usage)).toBeCloseTo(0.1365, 5)
  })

  it('still prices retired gpt-image-1-mini', () => {
    // 100/1e6*2 + 1000/1e6*2.5 + 4000/1e6*8 = 0.0002 + 0.0025 + 0.032
    expect(estimateImageCostUsd('openai/gpt-image-1-mini', usage)).toBeCloseTo(0.0347, 5)
  })

  it('falls back to input_tokens as text when no detail is reported', () => {
    expect(estimateImageCostUsd('openai/gpt-image-2.5-flare', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(5)
  })

  it('returns null for an unpriced model or missing usage', () => {
    expect(estimateImageCostUsd('openai/gpt-image-99', { input_tokens: 10, output_tokens: 10 })).toBeNull()
    expect(estimateImageCostUsd('openai/gpt-image-2.5-sunburst', undefined)).toBeNull()
  })
})

describe('image tiers', () => {
  it('the premium flag selects the Publication tier, otherwise Draft', () => {
    expect(tierFor(true)).toBe('publication')
    expect(tierFor(false)).toBe('draft')
  })

  it('Publication renders at high quality and Draft at medium', () => {
    expect(IMAGE_TIERS.publication.quality).toBe('high')
    expect(IMAGE_TIERS.draft.quality).toBe('medium')
  })
})
