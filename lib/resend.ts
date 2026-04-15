import { Resend } from 'resend'

let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

// From address — update once bossdaddylife.com domain is verified in Resend
export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'Boss Daddy <onboarding@resend.dev>'
