import { describe, it, expect } from 'vitest'
import { estimateImageCostUsd } from '@/lib/ai/pricing'

// Image generations now land on the piece's cost chip (generations stage
// 'image'). Only gpt-image-1 is priced; anything unknown is null, never a guess.

describe('estimateImageCostUsd', () => {
  it('prices gpt-image-1 per token class', () => {
    const usd = estimateImageCostUsd('openai/gpt-image-1', {
      input_tokens: 1_100,
      input_tokens_details: { text_tokens: 100, image_tokens: 1_000 },
      output_tokens: 4_000,
    })
    // 100/1e6*5 + 1000/1e6*10 + 4000/1e6*40 = 0.0005 + 0.01 + 0.16
    expect(usd).toBeCloseTo(0.1705, 5)
  })

  it('falls back to input_tokens as text when no detail is reported', () => {
    expect(estimateImageCostUsd('openai/gpt-image-1', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(5)
  })

  it('returns null for an unpriced model or missing usage', () => {
    expect(estimateImageCostUsd('openai/gpt-image-1.5', { input_tokens: 10, output_tokens: 10 })).toBeNull()
    expect(estimateImageCostUsd('openai/gpt-image-1', undefined)).toBeNull()
  })
})
