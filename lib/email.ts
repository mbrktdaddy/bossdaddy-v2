// Centralized email sender. Server-only.
//
// Why this exists: every helper that hits Resend directly has to remember to
// (a) use the `react:` field, (b) check the returned `error` object (Resend
// does not throw on API errors), and (c) wrap the call in try/catch. When any
// one of those is forgotten, failures are invisible. Routing everything
// through this function makes the correct pattern the only pattern.
import type * as React from 'react'
import { getResend, FROM_EMAIL } from '@/lib/resend'

export type EmailResult =
  | { ok: true }
  | { ok: false; error: string }

export interface SendEmailArgs {
  to: string
  subject: string
  react: React.ReactElement
  /** Short identifier used in log lines — e.g. 'order_confirmation', 'account_suspended'. */
  tag: string
}

export async function sendEmail(args: SendEmailArgs): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error(`email[${args.tag}] RESEND_API_KEY is unset — skipping send`)
    return { ok: false, error: 'RESEND_API_KEY is unset' }
  }

  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: args.to,
      subject: args.subject,
      react: args.react,
    })
    if (error) {
      const msg = error.message ?? String(error)
      console.error(`email[${args.tag}] resend error`, msg)
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`email[${args.tag}] threw`, msg)
    return { ok: false, error: msg }
  }
}
