import { describe, it, expect } from 'vitest'
import { estimateImageCostUsd } from '@/lib/ai/pricing'

// Image generations now land on the piece's cost chip (generations stage
// 'image'). gpt-image-1, 1.5 and 1-mini are priced (Standard list prices,
// 2026-10-23); anything unknown is null, never a guess.

const usage = {
  input_tokens: 1_100,
  input_tokens_details: { text_tokens: 100, image_tokens: 1_000 },
  output_tokens: 4_000,
}

describe('estimateImageCostUsd', () => {
  it('prices gpt-image-1 per token class', () => {
    // 100/1e6*5 + 1000/1e6*10 + 4000/1e6*40 = 0.0005 + 0.01 + 0.16
    expect(estimateImageCostUsd('openai/gpt-image-1', usage)).toBeCloseTo(0.1705, 5)
  })

  it('prices the premium tier (gpt-image-1.5) so premium runs stop logging null', () => {
    // 100/1e6*5 + 1000/1e6*8 + 4000/1e6*32 = 0.0005 + 0.008 + 0.128
    expect(estimateImageCostUsd('openai/gpt-image-1.5', usage)).toBeCloseTo(0.1365, 5)
  })

  it('prices gpt-image-1-mini', () => {
    // 100/1e6*2 + 1000/1e6*2.5 + 4000/1e6*8 = 0.0002 + 0.0025 + 0.032
    expect(estimateImageCostUsd('openai/gpt-image-1-mini', usage)).toBeCloseTo(0.0347, 5)
  })

  it('falls back to input_tokens as text when no detail is reported', () => {
    expect(estimateImageCostUsd('openai/gpt-image-1', { input_tokens: 1_000_000, output_tokens: 0 })).toBe(5)
  })

  it('returns null for an unpriced model or missing usage', () => {
    expect(estimateImageCostUsd('openai/gpt-image-2', { input_tokens: 10, output_tokens: 10 })).toBeNull()
    expect(estimateImageCostUsd('openai/gpt-image-1', undefined)).toBeNull()
  })
})
