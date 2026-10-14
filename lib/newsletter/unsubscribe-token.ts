// Signed newsletter-unsubscribe links (continuity-fix-plan B7).
//
// WHY this exists: the old link was `?email=<raw address>` and the GET deleted
// the row. Anyone could unsubscribe any address, and mail-security scanners
// (Gmail prefetch, Outlook SafeLinks) follow every link in a message, so real
// subscribers fell off the list without ever clicking. The fix has two halves:
// GET never mutates (it lands on a confirm page), and every link we mint now
// carries an HMAC of the address so the one automated path — the RFC 8058
// one-click POST a mail client fires from the `List-Unsubscribe` header — can
// prove the link came from us without a human in the loop.
//
// The token is HMAC-SHA256(secret, 'newsletter-unsubscribe:' + lowercased email),
// base64url. The prefix is domain separation: the same secret can never be
// replayed as a valid signature for some other feature that also MACs an email.
// No expiry on purpose — an unsubscribe link must keep working for as long as the
// message sits in an inbox.
//
// DEFAULT-SAFE DEGRADATION: if NEWSLETTER_UNSUBSCRIBE_SECRET is unset we mint NO
// token. URLs fall back to the legacy raw-email form (which only works through
// the human confirm step) and the digest omits the one-click headers. Nothing
// throws — a missing env var must never take down the weekly send. The knob stays
// the operator's: set the secret and links harden on the next send.
//
// Server-only: it reads the secret, and email templates that import it render on
// the server. Never import from a client component.

import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

const DOMAIN = 'newsletter-unsubscribe:'
const DEFAULT_SITE_URL = 'https://www.bossdaddylife.com'

/** Public confirmation page — the only thing a GET ever reaches. */
export const UNSUBSCRIBE_PAGE_PATH = '/newsletter/unsubscribe'
/** The mutating endpoint — POST only; GET redirects to the page. */
export const UNSUBSCRIBE_API_PATH = '/api/newsletter/unsubscribe'

let warnedMissingSecret = false

/**
 * Read lazily, never at import. Empty/whitespace counts as unset — an empty
 * string in Vercel would otherwise sign every token with a known (empty) key.
 */
function getSecret(): string | null {
  const secret = (process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? '').trim()
  if (secret) return secret
  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    console.warn(
      '[newsletter-unsubscribe] NEWSLETTER_UNSUBSCRIBE_SECRET unset or empty — ' +
      'unsubscribe links are unsigned (legacy raw-email form) and the digest sends ' +
      'no List-Unsubscribe one-click headers. Set it on Vercel and redeploy.',
    )
  }
  return null
}

function sign(secret: string, email: string): string {
  return createHmac('sha256', secret)
    .update(DOMAIN + email.trim().toLowerCase())
    .digest('base64url')
}

function siteOrigin(siteUrl?: string): string {
  return siteUrl || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL
}

/** Mint a token for an address, or null when no secret is configured. */
export function mintUnsubscribeToken(email: string): string | null {
  const secret = getSecret()
  return secret ? sign(secret, email) : null
}

/**
 * Constant-time check of a token against an address. False when no secret is
 * configured (nothing to verify against) or the token is malformed.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const secret = getSecret()
  if (!secret || !token) return false
  const expected = Buffer.from(sign(secret, email))
  const given = Buffer.from(token)
  // timingSafeEqual throws on unequal lengths, so the length check comes first.
  // Token length is not a secret (it is fixed), so branching on it leaks nothing.
  if (given.length !== expected.length) return false
  return timingSafeEqual(given, expected)
}

/**
 * How much do we trust this unsubscribe request?
 *   signed  — the token verifies; the link came from us.
 *   legacy  — no token (an email sent before signing existed) or a token we have
 *             no secret to check. Honoured ONLY through the human confirm step —
 *             it is no worse than a raw-email link, which is all we can offer.
 *   invalid — a token is present and wrong. Never fall back to legacy here; a bad
 *             signature is a tampered or truncated link.
 */
export type UnsubscribeTrust = 'signed' | 'legacy' | 'invalid'

export function classifyUnsubscribe(email: string, token: string | null | undefined): UnsubscribeTrust {
  if (!token) return 'legacy'
  if (!getSecret()) return 'legacy'
  return verifyUnsubscribeToken(email, token) ? 'signed' : 'invalid'
}

/**
 * The link to put in an email footer: the confirm PAGE, carrying `email` and —
 * when a secret is configured — `token`. A scanner that fetches it only renders
 * the page; the delete needs a POST.
 */
export function buildUnsubscribeUrl(email: string, siteUrl?: string): string {
  const url = new URL(UNSUBSCRIBE_PAGE_PATH, siteOrigin(siteUrl))
  url.searchParams.set('email', email)
  const token = mintUnsubscribeToken(email)
  if (token) url.searchParams.set('token', token)
  return url.toString()
}

/**
 * The RFC 8058 target: the API route itself, which mail clients POST to directly.
 * Null when no token can be minted — one-click needs a signed link, so without a
 * secret we simply don't advertise it.
 */
export function buildOneClickUnsubscribeUrl(email: string, siteUrl?: string): string | null {
  const token = mintUnsubscribeToken(email)
  if (!token) return null
  const url = new URL(UNSUBSCRIBE_API_PATH, siteOrigin(siteUrl))
  url.searchParams.set('email', email)
  url.searchParams.set('token', token)
  return url.toString()
}

/**
 * Per-recipient `headers` for a Resend send: `List-Unsubscribe` +
 * `List-Unsubscribe-Post`. Gmail and Yahoo require both (bulk-sender rules, 2024)
 * for the native "Unsubscribe" affordance, and it is the sanctioned alternative to
 * a spam report. Undefined when unsigned — never ship a one-click header whose
 * target would reject the POST.
 */
export function unsubscribeHeaders(email: string, siteUrl?: string): Record<string, string> | undefined {
  const url = buildOneClickUnsubscribeUrl(email, siteUrl)
  if (!url) return undefined
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}
