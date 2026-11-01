import { describe, it, expect } from 'vitest'
import { NoObjectGeneratedError } from 'ai'
import { CRITIC_CAPS, CriticOutput, clipFinding, clipSummary } from '@/lib/content/pipeline/critic/model'
import { classifyClaudeError } from '@/lib/ai/errors'

// 2026-10-31: an editor pass was thrown away because its summary ran past the
// 500-character cap — five good findings lost, and the console said only
// "response did not match schema". Now the schema accepts up to a hard cap and
// the route clips to the display cap; the classifier names the failing field;
// the failed row keeps up to 12k characters of the raw answer.

// The constructor wants response + usage metadata the classifier never reads.
type NoObjectOpts = ConstructorParameters<typeof NoObjectGeneratedError>[0]
function noObjectOpts(o: { cause?: Error; text: string; finishReason: 'stop' | 'length' }): NoObjectOpts {
  return {
    message: 'No object generated: response did not match schema.',
    cause: o.cause,
    text: o.text,
    finishReason: o.finishReason,
    response: { id: 'r', timestamp: new Date(0), modelId: 'test' },
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  } as unknown as NoObjectOpts
}

const finding = { severity: 'note' as const, code: 'other' as const, part: 2, quote: 'short quote', message: 'short message' }

describe('CriticOutput caps', () => {
  it('accepts a summary and a message past the display cap (they are clipped later, not rejected)', () => {
    const r = CriticOutput.safeParse({
      findings: [{ ...finding, message: 'm'.repeat(CRITIC_CAPS.message + 200) }],
      summary: 's'.repeat(CRITIC_CAPS.summary + 400),
    })
    expect(r.success).toBe(true)
  })

  it('still rejects the absurd (a 2000-character summary) and a bad code', () => {
    expect(CriticOutput.safeParse({ findings: [], summary: 's'.repeat(2000) }).success).toBe(false)
    expect(CriticOutput.safeParse({ findings: [{ ...finding, code: 'nope' }], summary: 'ok' }).success).toBe(false)
  })
})

describe('clipFinding / clipSummary', () => {
  it('passes short text through untouched', () => {
    expect(clipFinding(finding)).toEqual(finding)
    expect(clipSummary('Two sentences.')).toBe('Two sentences.')
  })

  it('clips on a word boundary with an ellipsis, under the display cap', () => {
    const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const c = clipFinding({ ...finding, message: long, quote: long })
    expect(c.message.length).toBeLessThanOrEqual(CRITIC_CAPS.message)
    expect(c.message.endsWith('…')).toBe(true)
    // Cut between words, not inside one: the kept prefix is a prefix of the
    // original and the original continues with a space right after it.
    const kept = c.message.slice(0, -1)
    expect(long.startsWith(kept)).toBe(true)
    expect(long[kept.length]).toBe(' ')
    expect(c.quote!.length).toBeLessThanOrEqual(CRITIC_CAPS.quote)
    const s = clipSummary(long)
    expect(s.length).toBeLessThanOrEqual(CRITIC_CAPS.summary)
  })

  it('keeps a null quote null', () => {
    expect(clipFinding({ ...finding, quote: null }).quote).toBeNull()
  })
})

describe('classifyClaudeError names the schema field', () => {
  it('surfaces the zod issue path from the error cause', () => {
    // The SDK's real nesting: NoObjectGeneratedError → TypeValidationError → ZodError (with `issues`).
    const zodLike = Object.assign(new Error('zod'), { issues: [{ path: ['summary'], message: 'Too big: expected string to have <=500 characters' }] })
    const typeErr = Object.assign(new Error('Type validation failed'), { cause: zodLike })
    const err = new NoObjectGeneratedError(noObjectOpts({ cause: typeErr, text: '{"findings":[],"summary":"' + 'x'.repeat(3000) + '"}', finishReason: 'stop' }))
    const c = classifyClaudeError(err)
    expect(c.kind).toBe('no_object')
    expect(c.detail).toContain('summary: Too big')
    expect(c.rawText?.length).toBeGreaterThan(2000)
  })

  it('a length finish is still truncation', () => {
    const err = new NoObjectGeneratedError(noObjectOpts({ text: '{"fin', finishReason: 'length' }))
    expect(classifyClaudeError(err).kind).toBe('truncated')
  })
})
