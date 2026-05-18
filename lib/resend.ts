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
