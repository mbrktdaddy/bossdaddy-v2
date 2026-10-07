import { describe, it, expect } from 'vitest'
import { APICallError, NoObjectGeneratedError, NoOutputGeneratedError, RetryError } from 'ai'
import { classifyClaudeError } from '@/lib/ai/errors'

function apiError(statusCode: number | undefined, message = 'boom') {
  return new APICallError({
    message,
    url: 'https://ai-gateway.vercel.sh',
    requestBodyValues: {},
    statusCode,
  })
}

const responseMeta = { id: 'r1', timestamp: new Date(0), modelId: 'anthropic/claude-sonnet-4.6' }
const usage = {
  inputTokens: 1,
  inputTokenDetails: { noCacheTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
  outputTokens: 1,
  outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
  totalTokens: 2,
}
function noObject(finishReason: 'length' | 'stop' | 'error') {
  return new NoObjectGeneratedError({ message: 'no object', response: responseMeta, usage, finishReason })
}

describe('classifyClaudeError', () => {
  it('maps provider HTTP status codes to kinds', () => {
    expect(classifyClaudeError(apiError(429))).toMatchObject({ kind: 'rate_limit', status: 429 })
    expect(classifyClaudeError(apiError(402))).toMatchObject({ kind: 'budget', status: 503 })
    expect(classifyClaudeError(apiError(408))).toMatchObject({ kind: 'timeout', status: 502 })
    expect(classifyClaudeError(apiError(529))).toMatchObject({ kind: 'overload', status: 502 })
    expect(classifyClaudeError(apiError(503))).toMatchObject({ kind: 'overload', status: 502 })
    expect(classifyClaudeError(apiError(400))).toMatchObject({ kind: 'unknown', status: 502 })
  })

  it('distinguishes truncation from unexpected format (generateObject)', () => {
    expect(classifyClaudeError(noObject('length')).kind).toBe('truncated')
    expect(classifyClaudeError(noObject('stop')).kind).toBe('no_object')
  })

  it('falls back to message-regex for non-SDK errors', () => {
    expect(classifyClaudeError(new Error('request timed out')).kind).toBe('timeout')
    expect(classifyClaudeError(new Error('Overloaded (529)')).kind).toBe('overload')
    expect(classifyClaudeError(new Error('kaboom')).kind).toBe('unknown')
  })

  it('keeps internal detail out of userMessage (audit A6) and defaults to 502', () => {
    const c = classifyClaudeError(new Error('secret internal trace xyz'))
    expect(c.status).toBe(502)
    expect(c.userMessage).not.toContain('secret')
    expect(c.detail).toContain('secret')
  })

  it('reads a bare abort (the call timed out during a retry wait) as a timeout', () => {
    const c = classifyClaudeError(new DOMException('Delay was aborted', 'AbortError'))
    expect(c.kind).toBe('timeout')
    expect(c.detail).toBe('AbortError: Delay was aborted')
  })

  it('classifies exhausted SDK retries by the last real error', () => {
    const err = new RetryError({ message: 'Failed after 3 attempts', reason: 'maxRetriesExceeded', errors: [apiError(529, 'Overloaded'), apiError(529, 'Overloaded'), apiError(504, 'Gateway timeout')] })
    const c = classifyClaudeError(err)
    expect(c.kind).toBe('timeout')
    expect(c.detail).toMatch(/^after 3 attempts: \[504\]/)
  })

  it('reads a Gateway error by its statusCode (GatewayError is not an APICallError)', () => {
    const gatewayErr = Object.assign(new Error('Rate limit exceeded'), { name: 'GatewayRateLimitError', statusCode: 429 })
    const c = classifyClaudeError(gatewayErr)
    expect(c.kind).toBe('rate_limit')
    expect(c.detail).toBe('[429] GatewayRateLimitError: Rate limit exceeded')
  })

  it('reads a research run that ran out of output tokens as truncation, out of steps as no_object', () => {
    const length = new NoOutputGeneratedError({ message: 'No output: finishReason=length after 1 step(s), 1500 output tokens in the last step' })
    expect(classifyClaudeError(length).kind).toBe('truncated')
    const steps = new NoOutputGeneratedError({ message: 'No output: finishReason=tool-calls after 5 step(s), 300 output tokens in the last step' })
    expect(classifyClaudeError(steps).kind).toBe('no_object')
  })
})
