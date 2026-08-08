import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// The signing key is read from the environment at first use and cached, so the
// secret has to be in place before the module is imported.
const ORIGINAL = process.env.GOAL_LINK_SECRET
process.env.GOAL_LINK_SECRET = 'test-secret-not-a-real-key-000000'

const { mintOccurrenceToken, verifyOccurrenceToken, oneTapUrl } =
  await import('@/lib/goals/links')

afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.GOAL_LINK_SECRET
  else process.env.GOAL_LINK_SECRET = ORIGINAL
})

const OCC = '3f8a1c22-9b4e-4d1a-8f0e-77c2b5a91d34'
const NOW = new Date('2026-08-07T12:00:00Z')

describe('mint + verify', () => {
  let token: string
  beforeAll(() => {
    token = mintOccurrenceToken(OCC, NOW)!
  })

  it('round-trips the occurrence id', () => {
    const result = verifyOccurrenceToken(token, NOW)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.payload.occurrenceId).toBe(OCC)
  })

  it('is URL-safe — no characters an email client will mangle', () => {
    expect(token).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(encodeURIComponent(token)).toBe(token)
  })

  it('rejects a tampered occurrence id', () => {
    const forged = token.replace(OCC, '00000000-0000-4000-8000-000000000000')
    expect(verifyOccurrenceToken(forged, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a tampered expiry — you cannot extend your own link', () => {
    const [v, occ, exp, sig] = token.split('.')
    const extended = `${v}.${occ}.${Number(exp) + 86_400}.${sig}`
    expect(verifyOccurrenceToken(extended, NOW)).toEqual({ ok: false, reason: 'bad_signature' })
  })

  it('rejects a tampered signature', () => {
    const parts = token.split('.')
    parts[3] = 'AAAA' + parts[3]!.slice(4)
    expect(verifyOccurrenceToken(parts.join('.'), NOW).ok).toBe(false)
  })

  it('reports expiry distinctly so the page can say something true', () => {
    const shortLived = mintOccurrenceToken(OCC, NOW, 1)!
    const later = new Date(NOW.getTime() + 2 * 86_400_000)
    expect(verifyOccurrenceToken(shortLived, later)).toEqual({ ok: false, reason: 'expired' })
  })

  it('is still valid just inside its window', () => {
    const shortLived = mintOccurrenceToken(OCC, NOW, 1)!
    const justBefore = new Date(NOW.getTime() + 86_400_000 - 1000)
    expect(verifyOccurrenceToken(shortLived, justBefore).ok).toBe(true)
  })

  it('rejects malformed shapes without throwing', () => {
    for (const bad of ['', 'garbage', 'v1.abc.123', `v2.${OCC}.999999999.sig`, `${OCC}.999.sig`]) {
      expect(() => verifyOccurrenceToken(bad, NOW)).not.toThrow()
      expect(verifyOccurrenceToken(bad, NOW).ok).toBe(false)
    }
  })

  it('rejects a non-uuid occurrence id (no lookups on attacker-shaped input)', () => {
    expect(verifyOccurrenceToken('v1.../../etc/passwd.999999999.sig', NOW))
      .toEqual({ ok: false, reason: 'malformed' })
  })

  it('binds a token to exactly one occurrence', () => {
    const other = '11111111-2222-4333-8444-555555555555'
    const otherToken = mintOccurrenceToken(other, NOW)!
    expect(otherToken).not.toBe(token)
    const result = verifyOccurrenceToken(otherToken, NOW)
    if (result.ok) expect(result.payload.occurrenceId).toBe(other)
  })
})

describe('oneTapUrl', () => {
  it('builds an absolute URL and tolerates a trailing slash', () => {
    expect(oneTapUrl(OCC, 'https://www.bossdaddylife.com', NOW))
      .toMatch(/^https:\/\/www\.bossdaddylife\.com\/g\/v1\./)
    expect(oneTapUrl(OCC, 'https://www.bossdaddylife.com/', NOW))
      .not.toMatch(/\/\/g\//)
  })

  it('produces a link the page can verify', () => {
    const url = oneTapUrl(OCC, 'https://www.bossdaddylife.com', NOW)!
    const token = url.split('/g/')[1]!
    expect(verifyOccurrenceToken(token, NOW).ok).toBe(true)
  })
})
