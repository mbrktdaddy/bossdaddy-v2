// The signed unsubscribe link is the only thing standing between "a mail client's
// one-click POST" and "anyone can delete any subscriber", so the properties worth
// pinning are the security-relevant ones: tokens are bound to the address, case
// doesn't matter, tampering fails, and a missing secret degrades to unsigned
// links rather than throwing or minting a token under an empty key.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildOneClickUnsubscribeUrl,
  buildUnsubscribeUrl,
  classifyUnsubscribe,
  mintUnsubscribeToken,
  unsubscribeHeaders,
  verifyUnsubscribeToken,
} from '@/lib/newsletter/unsubscribe-token'

const SITE = 'https://www.bossdaddylife.com'

beforeEach(() => {
  vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'test-secret-0123456789abcdef')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('mint / verify', () => {
  it('round-trips for the same address', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(verifyUnsubscribeToken('dad@example.com', token)).toBe(true)
  })

  it('is case- and whitespace-insensitive on the address', () => {
    const token = mintUnsubscribeToken('Dad@Example.com')!
    expect(verifyUnsubscribeToken(' dad@example.com ', token)).toBe(true)
  })

  it('binds the token to the address', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    expect(verifyUnsubscribeToken('other@example.com', token)).toBe(false)
  })

  it('rejects tampered, truncated, empty and over-long tokens without throwing', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    const flipped = (token[0] === 'A' ? 'B' : 'A') + token.slice(1)
    expect(verifyUnsubscribeToken('dad@example.com', flipped)).toBe(false)
    expect(verifyUnsubscribeToken('dad@example.com', token.slice(0, -1))).toBe(false)
    expect(verifyUnsubscribeToken('dad@example.com', token + 'x')).toBe(false)
    expect(verifyUnsubscribeToken('dad@example.com', '')).toBe(false)
  })

  it('does not verify under a different secret', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', 'a-different-secret-entirely')
    expect(verifyUnsubscribeToken('dad@example.com', token)).toBe(false)
  })
})

describe('classifyUnsubscribe', () => {
  it('signed: valid token', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    expect(classifyUnsubscribe('dad@example.com', token)).toBe('signed')
  })

  it('invalid: a present-but-wrong token never falls back to legacy', () => {
    expect(classifyUnsubscribe('dad@example.com', 'not-a-real-token')).toBe('invalid')
  })

  it('legacy: no token (links from emails sent before signing)', () => {
    expect(classifyUnsubscribe('dad@example.com', '')).toBe('legacy')
    expect(classifyUnsubscribe('dad@example.com', null)).toBe('legacy')
  })

  it('legacy: a token we have no secret to check', () => {
    const token = mintUnsubscribeToken('dad@example.com')!
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', '')
    expect(classifyUnsubscribe('dad@example.com', token)).toBe('legacy')
  })
})

describe('URL builders', () => {
  it('confirm-page URL carries email and a token that verifies', () => {
    const url = new URL(buildUnsubscribeUrl('dad+news@example.com', SITE))
    expect(url.origin + url.pathname).toBe(`${SITE}/newsletter/unsubscribe`)
    expect(url.searchParams.get('email')).toBe('dad+news@example.com')
    expect(verifyUnsubscribeToken('dad+news@example.com', url.searchParams.get('token')!)).toBe(true)
  })

  it('one-click URL targets the API route with email + token', () => {
    const url = new URL(buildOneClickUnsubscribeUrl('dad@example.com', SITE)!)
    expect(url.origin + url.pathname).toBe(`${SITE}/api/newsletter/unsubscribe`)
    expect(verifyUnsubscribeToken('dad@example.com', url.searchParams.get('token')!)).toBe(true)
  })

  it('headers are RFC 8058 shaped: angle-bracketed https URL + One-Click post', () => {
    const headers = unsubscribeHeaders('dad@example.com', SITE)!
    expect(headers['List-Unsubscribe']).toMatch(/^<https:\/\/.+\/api\/newsletter\/unsubscribe\?.+>$/)
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})

describe('no secret configured', () => {
  beforeEach(() => {
    vi.stubEnv('NEWSLETTER_UNSUBSCRIBE_SECRET', '')
  })

  it('mints no token, never throws', () => {
    expect(mintUnsubscribeToken('dad@example.com')).toBeNull()
    expect(verifyUnsubscribeToken('dad@example.com', 'anything')).toBe(false)
  })

  it('falls back to the legacy raw-email page URL with no token', () => {
    const url = new URL(buildUnsubscribeUrl('dad@example.com', SITE))
    expect(url.searchParams.get('email')).toBe('dad@example.com')
    expect(url.searchParams.has('token')).toBe(false)
  })

  it('advertises no one-click target and sends no List-Unsubscribe headers', () => {
    expect(buildOneClickUnsubscribeUrl('dad@example.com', SITE)).toBeNull()
    expect(unsubscribeHeaders('dad@example.com', SITE)).toBeUndefined()
  })
})
