import { describe, it, expect } from 'vitest'
import { researchProviderFor } from '@/lib/ai/research'
import { MODELS } from '@/lib/ai/models'

// The research bucket dispatches web search to the RESOLVED provider's native
// tool (Anthropic web search vs xAI Grok Live Search). This guards that contract:
// a `xai/*` slug uses Grok's search, everything else falls back to Anthropic (the
// default + the app-level failover provider).
describe('researchProviderFor', () => {
  it('routes xAI/Grok slugs to xAI Live Search', () => {
    expect(researchProviderFor(MODELS.grok)).toBe('xai')
    expect(researchProviderFor(MODELS.grokFast)).toBe('xai')
    expect(researchProviderFor('xai/grok-4.5')).toBe('xai')
  })

  it('routes Anthropic slugs to Anthropic web search', () => {
    expect(researchProviderFor(MODELS.claudeSonnet)).toBe('anthropic')
    expect(researchProviderFor(MODELS.claudeOpus)).toBe('anthropic')
  })

  it('falls back to Anthropic for any other provider (default + failover provider)', () => {
    expect(researchProviderFor('openai/gpt-5.5')).toBe('anthropic')
    expect(researchProviderFor('google/gemini-3.1-pro')).toBe('anthropic')
    expect(researchProviderFor('')).toBe('anthropic')
  })
})
