import { describe, it, expect } from 'vitest'
import { summarizePromptPerformance, UNTRACKED_VERSION } from '@/lib/content/performance'

const row = (over: Partial<Parameters<typeof summarizePromptPerformance>[0][number]> = {}) => ({
  content_type: 'review', prompt_version: '2026-10-23.2', generation_method: 'ai-drafted', view_count: 10, scroll_75_count: 4, ...over,
})

describe('summarizePromptPerformance', () => {
  it('groups by version + method and derives the finish rate from the sums', () => {
    const out = summarizePromptPerformance([row(), row({ view_count: 30, scroll_75_count: 6 })])
    expect(out).toEqual([{ promptVersion: '2026-10-23.2', generationMethod: 'ai-drafted', pieces: 2, views: 40, finishRate: 0.25 }])
  })

  it('newest version first, untracked last, zero-view groups dropped', () => {
    const out = summarizePromptPerformance([
      row({ prompt_version: null, generation_method: null }),
      row({ prompt_version: '2026-10-23.1' }),
      row({ prompt_version: '2026-10-23.2', view_count: 0, scroll_75_count: 0 }),
      row({ prompt_version: '2026-10-23.2', generation_method: 'ai-assisted' }),
    ])
    expect(out.map((r) => [r.promptVersion, r.generationMethod])).toEqual([
      ['2026-10-23.2', 'ai-assisted'],
      ['2026-10-23.1', 'ai-drafted'],
      [UNTRACKED_VERSION, 'unknown'],
    ])
  })

  it('never reports more than 100% (a scroll ping can outrun its view ping)', () => {
    expect(summarizePromptPerformance([row({ view_count: 2, scroll_75_count: 5 })])[0].finishRate).toBe(1)
  })
})
