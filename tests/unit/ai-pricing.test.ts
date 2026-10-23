import { describe, it, expect } from 'vitest'
import { estimateCostUsd } from '@/lib/ai/pricing'
import type { LanguageModelUsage } from 'ai'

function usage(input: number, output: number, cacheRead = 0, cacheWrite = 0): LanguageModelUsage {
  return {
    inputTokens: input,
    inputTokenDetails: { noCacheTokens: input - cacheRead - cacheWrite, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite },
    outputTokens: output,
    outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
    totalTokens: input + output,
  } as LanguageModelUsage
}

describe('estimateCostUsd', () => {
  it('prices Sonnet 5 at list ($3 in / $15 out per 1M)', () => {
    expect(estimateCostUsd('anthropic/claude-sonnet-5', usage(1_000_000, 1_000_000))).toBe(18)
  })
  it('bills cache reads at 10% and cache writes at 125% of input', () => {
    // 1M input of which 500k cache-read, 100k cache-write, 400k plain
    const usd = estimateCostUsd('anthropic/claude-sonnet-5', usage(1_000_000, 0, 500_000, 100_000))
    expect(usd).toBeCloseTo(0.4 * 3 + 0.5 * 0.3 + 0.1 * 3.75, 5)
  })
  it('returns null for an unpriced slug rather than guessing', () => {
    expect(estimateCostUsd('xai/grok-4.7', usage(1000, 1000))).toBeNull()
    expect(estimateCostUsd('anthropic/claude-sonnet-5', undefined)).toBeNull()
  })
})
