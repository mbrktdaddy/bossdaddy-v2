// Signed one-tap tokens for logging an occurrence from a push or an email.
//
// WHY STATELESS: native notification action buttons don't exist for a PWA
// (Chrome/Android has them, iOS doesn't; widgets and Siri shortcuts are native
// only). The cross-platform substitute is a link that works from a push, an
// email, or a desktop browser. A stored token per occurrence would mean a table
// write per reminder and a row that outlives its purpose, so these are HMAC
// signatures over the occurrence id instead — nothing to store, nothing to clean
// up, and revocation comes free from the expiry.
//
// The token authorizes the OCCURRENCE, not a specific action: the landing page
// offers "did it" / "skipped" / "not today" off one signature. Fewer tokens in
// flight, and the choice stays the user's.
//
// SECURITY NOTES
//   • The token IS the authorization — no session required, which is the point.
//     Scope is therefore deliberately tiny: one occurrence, one short window,
//     and the only reachable writes are its own log entry and status.
//   • GET must never mutate. Mail clients and link scanners prefetch, so the
//     token lands on a page whose button POSTs. See app/g/[token]/page.tsx.
//   • The signing key is HKDF-derived from a server secret with a fixed info
//     string, so the token can never be used to work backwards toward the
//     secret it was derived from.

import 'server-only'
import { createHmac, hkdfSync, timingSafeEqual } from 'node:crypto'

const VERSION = 'v1'
const DEFAULT_TTL_DAYS = 14
const HKDF_INFO = 'bossdaddy/goal-one-tap/v1'

export type TokenPayload = {
  occurrenceId: string
  expiresAt: Date
}

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'unconfigured' }

/**
 * Mints a token for one occurrence. `ttlDays` should comfortably exceed the
 * reminder's useful life — a link that dies before a dad opens his email is
 * worse than no link.
 */
export function mintOccurrenceToken(
  occurrenceId: string,
  now: Date = new Date(),
  ttlDays: number = DEFAULT_TTL_DAYS,
): string | null {
  const key = signingKey()
  if (!key) return null
  const exp = Math.floor(now.getTime() / 1000) + Math.round(ttlDays * 86_400)
  const body = `${VERSION}.${occurrenceId}.${exp}`
  return `${body}.${sign(body, key)}`
}

/** Verifies a token. Every failure mode is distinguished so the landing page can say something true. */
export function verifyOccurrenceToken(token: string, now: Date = new Date()): VerifyResult {
  const key = signingKey()
  if (!key) return { ok: false, reason: 'unconfigured' }

  const parts = token.split('.')
  if (parts.length !== 4) return { ok: false, reason: 'malformed' }
  const [version, occurrenceId, expRaw, signature] = parts as [string, string, string, string]
  if (version !== VERSION) return { ok: false, reason: 'malformed' }
  if (!UUID_RE.test(occurrenceId)) return { ok: false, reason: 'malformed' }
  if (!/^\d{1,12}$/.test(expRaw)) return { ok: false, reason: 'malformed' }

  const expected = sign(`${version}.${occurrenceId}.${expRaw}`, key)
  if (!constantTimeEquals(signature, expected)) return { ok: false, reason: 'bad_signature' }

  // Expiry is checked AFTER the signature so an attacker can't learn anything
  // from response timing on a forged token.
  const expiresAt = new Date(Number(expRaw) * 1000)
  if (expiresAt.getTime() <= now.getTime()) return { ok: false, reason: 'expired' }

  return { ok: true, payload: { occurrenceId, expiresAt } }
}

/** Absolute one-tap URL for an occurrence, or null when signing isn't configured. */
export function oneTapUrl(occurrenceId: string, siteUrl: string, now?: Date): string | null {
  const token = mintOccurrenceToken(occurrenceId, now)
  return token ? `${siteUrl.replace(/\/$/, '')}/g/${token}` : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function sign(body: string, key: Buffer): string {
  return createHmac('sha256', key).update(body).digest('base64url')
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  // timingSafeEqual throws on length mismatch, which would itself leak length.
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

let cachedKey: Buffer | null = null

/**
 * Derives the signing key. `GOAL_LINK_SECRET` is honored if set — the knob stays
 * available for key rotation independent of everything else — but the default
 * derives from the service-role key so this works with zero new environment
 * configuration. HKDF with a fixed info string keeps the derived key
 * cryptographically separated from its source.
 */
function signingKey(): Buffer | null {
  if (cachedKey) return cachedKey
  const secret = process.env.GOAL_LINK_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) return null
  const derived = hkdfSync('sha256', Buffer.from(secret), Buffer.alloc(0), HKDF_INFO, 32)
  cachedKey = Buffer.from(derived)
  return cachedKey
}
