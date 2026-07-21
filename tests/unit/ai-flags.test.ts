import { describe, it, expect, afterEach } from 'vitest'
import { resolveModel } from '@/lib/flags'
import { MODELS } from '@/lib/ai/models'

const ENV_KEYS = [
  'AI_MODEL_CONTENT',
  'AI_MODEL_RESEARCH',
  'AI_MODEL_UTILITY',
  'AI_MODEL_MODERATION',
  'AI_MODEL_CONCIERGE',
  'AI_MODEL_CONCIERGE_SENSITIVE',
] as const

afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k]
})

describe('resolveModel', () => {
  it('defaults every bucket to Claude Sonnet with no fallback', () => {
    for (const b of ['content', 'research', 'utility', 'moderation', 'concierge'] as const) {
      expect(resolveModel(b)).toEqual({ model: MODELS.claudeSonnet, fallback: [] })
    }
  })

  it('applies an env override and adds Claude as an automatic fallback', () => {
    process.env.AI_MODEL_CONTENT = MODELS.grok
    expect(resolveModel('content')).toEqual({ model: MODELS.grok, fallback: [MODELS.claudeSonnet] })
  })

  it('ignores a non-slug override and stays on the default', () => {
    process.env.AI_MODEL_CONTENT = 'grok4' // missing provider/ prefix
    expect(resolveModel('content')).toEqual({ model: MODELS.claudeSonnet, fallback: [] })
  })

  it('never lets moderation be overridden (compliance pin)', () => {
    process.env.AI_MODEL_MODERATION = MODELS.grok
    expect(resolveModel('moderation')).toEqual({ model: MODELS.claudeSonnet, fallback: [] })
  })

  it('keeps the concierge sensitive lane on Claude even when base concierge is Grok', () => {
    process.env.AI_MODEL_CONCIERGE = MODELS.grok
    expect(resolveModel('concierge')).toEqual({ model: MODELS.grok, fallback: [MODELS.claudeSonnet] })
    expect(resolveModel('concierge', { sensitive: true })).toEqual({
      model: MODELS.claudeSonnet,
      fallback: [],
    })
  })

  it('allows overriding the concierge sensitive lane independently', () => {
    process.env.AI_MODEL_CONCIERGE_SENSITIVE = MODELS.grok
    expect(resolveModel('concierge', { sensitive: true })).toEqual({
      model: MODELS.grok,
      fallback: [MODELS.claudeSonnet],
    })
  })

  it('honors an explicit per-request model, superseding the bucket default and env', () => {
    process.env.AI_MODEL_CONTENT = MODELS.grok
    // A user-facing tier picker (X Studio repurpose) chooses Opus outright —
    // any non-Sonnet model still gets the automatic Sonnet fallback.
    expect(resolveModel('content', { model: MODELS.claudeOpus })).toEqual({
      model: MODELS.claudeOpus,
      fallback: [MODELS.claudeSonnet],
    })
    // A non-Claude explicit pick still gets the automatic Claude fallback.
    expect(resolveModel('content', { model: MODELS.grok })).toEqual({
      model: MODELS.grok,
      fallback: [MODELS.claudeSonnet],
    })
  })

  it('ignores an invalid explicit model and falls back to normal resolution', () => {
    expect(resolveModel('content', { model: 'opus' })).toEqual({
      model: MODELS.claudeSonnet,
      fallback: [],
    })
  })

  it('never lets an explicit model override a compliance-pinned bucket', () => {
    expect(resolveModel('moderation', { model: MODELS.grok })).toEqual({
      model: MODELS.claudeSonnet,
      fallback: [],
    })
  })
})
