import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// From address — defaults to the Resend sandbox sender if the env var is
// unset OR empty. Using ?? would only catch unset; we hit empty-string in
// prod once (2026-05-09) and silently kept FROM_EMAIL="" which Resend
// rejected. The startup warn surfaces the fallback in vercel logs so the
// next regression is loud, not silent.
const _configuredFrom = (process.env.RESEND_FROM_EMAIL ?? '').trim()
export const FROM_EMAIL = _configuredFrom || 'Boss Daddy <onboarding@resend.dev>'

if (!_configuredFrom && process.env.NODE_ENV === 'production') {
  console.warn(
    '[resend] RESEND_FROM_EMAIL unset or empty — falling back to onboarding@resend.dev. ' +
    'Sandbox sender only delivers to the Resend account owner; all other recipients get nothing. ' +
    'Set RESEND_FROM_EMAIL to a verified-domain sender on Vercel and redeploy.'
  )
}

// Default Reply-To. Replies to hello@ already reach the same inbox, but pointing
// them at support@ files them under the Support label instead of the general
// contact stream — and having a real reply path at all is one of the signals
// Gmail weighs when sorting Primary vs Promotions.
const _configuredReplyTo = (process.env.RESEND_REPLY_TO_EMAIL ?? '').trim()
export const REPLY_TO_EMAIL = _configuredReplyTo || 'support@bossdaddylife.com'

/**
 * FROM_EMAIL with the display name replaced by a person's name.
 *
 * A goal invite from "Boss Daddy" reads as a campaign; one from "bossdaddy1 via
 * Boss Daddy" reads as a message from a human. That's the pattern Google Docs,
 * GitHub and Slack all use, and it's the cheapest lever on Gmail's Primary-vs-
 * Promotions decision (our goal invite landed in Promotions on 2026-08-16 while
 * the plainer signup confirmation went to Primary). The address never changes —
 * only the display name, so SPF/DKIM/DMARC alignment is untouched.
 *
 * SECURITY: `name` is UNTRUSTED — it's a username. It is quoted per RFC 5322,
 * and CR/LF plus other control characters are stripped so a crafted username
 * cannot inject additional headers. Returns FROM_EMAIL unchanged if the name
 * sanitizes down to nothing.
 */
export function fromPerson(name?: string | null): string {
  const safe = sanitizeDisplayName(name)
  if (!safe) return FROM_EMAIL

  // FROM_EMAIL is normally "Boss Daddy <hello@…>" but tolerate a bare address.
  const angle = FROM_EMAIL.match(/<([^>]+)>/)
  const address = (angle ? angle[1] : FROM_EMAIL).trim()

  return `"${safe} via Boss Daddy" <${address}>`
}

function sanitizeDisplayName(raw?: string | null): string {
  if (!raw) return ''
  return (
    raw
      // Control characters incl. CR/LF — the header-injection vector.
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      // Backslash is RFC 5322's escape char and `"` would close the quoted
      // string early. Dropping both is simpler than escaping and loses nothing
      // meaningful from a username.
      .replace(/["\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      // Keep the assembled header inside a sane single line.
      .slice(0, 64)
  )
}
