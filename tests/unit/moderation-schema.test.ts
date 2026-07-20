import { describe, it, expect } from 'vitest'
import { ModerationResultSchema } from '@/lib/claude/moderation'

// Regression guard for the "malformed AI JSON silently auto-publishes" finding.
// Both moderation paths now `safeParse` Claude's output against this schema and
// fail safe on a mismatch instead of trusting an unvalidated `as` cast.
describe('ModerationResultSchema', () => {
  it('accepts a well-formed moderation result', () => {
    const r = ModerationResultSchema.safeParse({
      score: 0.9,
      flags: ['spam'],
      recommendation: 'reject',
    })
    expect(r.success).toBe(true)
  })

  it('accepts the boundary scores 0 and 1', () => {
    expect(ModerationResultSchema.safeParse({ score: 0, flags: [], recommendation: 'approve' }).success).toBe(true)
    expect(ModerationResultSchema.safeParse({ score: 1, flags: [], recommendation: 'reject' }).success).toBe(true)
  })

  it('rejects an empty object (the silent-auto-publish shape)', () => {
    // `{}` → score/recommendation undefined → old code auto-approved.
    expect(ModerationResultSchema.safeParse({}).success).toBe(false)
  })

  it('rejects a stringified score', () => {
    expect(
      ModerationResultSchema.safeParse({ score: '0.9', flags: [], recommendation: 'reject' }).success,
    ).toBe(false)
  })

  it('rejects a score outside 0–1', () => {
    expect(ModerationResultSchema.safeParse({ score: 1.5, flags: [], recommendation: 'reject' }).success).toBe(false)
    expect(ModerationResultSchema.safeParse({ score: -0.1, flags: [], recommendation: 'approve' }).success).toBe(false)
  })

  it('rejects an unknown recommendation value', () => {
    expect(
      ModerationResultSchema.safeParse({ score: 0.5, flags: [], recommendation: 'block' }).success,
    ).toBe(false)
  })

  it('rejects a missing recommendation', () => {
    expect(ModerationResultSchema.safeParse({ score: 0.5, flags: [] }).success).toBe(false)
  })

  it('rejects non-string flag entries', () => {
    expect(
      ModerationResultSchema.safeParse({ score: 0.5, flags: [1, 2], recommendation: 'review' }).success,
    ).toBe(false)
  })
})
