// Centralized email sender. Server-only.
//
// Why this exists: every helper that hits Resend directly has to remember to
// (a) use the `react:` field, (b) check the returned `error` object (Resend
// does not throw on API errors), and (c) wrap the call in try/catch. When any
// one of those is forgotten, failures are invisible. Routing everything
// through this function makes the correct pattern the only pattern.
import type * as React from 'react'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { getSuppression, isCriticalTag, suppressionBlocks } from '@/lib/email-suppression'

export type EmailResult =
  | { ok: true }
  | { ok: false; error: string }

export interface SendEmailArgs {
  to: string
  subject: string
  react: React.ReactElement
  /** Short identifier used in log lines — e.g. 'order_confirmation', 'account_suspended'. */
  tag: string
  /**
   * Overrides the suppression carve-out normally derived from `tag`.
   *
   * Critical mail (order confirmations, account-status notices) still sends to
   * an address that filed a spam COMPLAINT, because a complaint means "stop
   * marketing", not "cancel my order receipt". It never overrides a hard
   * BOUNCE — a dead address is dead. Defaults to isCriticalTag(tag), so the
   * safe behaviour is automatic and this is only for one-offs.
   */
  critical?: boolean
}

export async function sendEmail(args: SendEmailArgs): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error(`email[${args.tag}] RESEND_API_KEY is unset — skipping send`)
    return { ok: false, error: 'RESEND_API_KEY is unset' }
  }

  // Suppression gate. Mailbox providers score senders on whether they STOP
  // mailing addresses that reject them, so continuing to hit a bounced address
  // damages delivery for every other recipient. getSuppression() fails open on
  // a DB error — a database blip must not halt all site email.
  const suppression = await getSuppression(args.to)
  if (suppression) {
    const critical = args.critical ?? isCriticalTag(args.tag)
    if (suppressionBlocks(suppression, critical)) {
      const why = `suppressed (${suppression.reason}${suppression.bounceSubtype ? `/${suppression.bounceSubtype}` : ''})`
      console.warn(`email[${args.tag}] skipping ${args.to} — ${why}`)
      return { ok: false, error: why }
    }
    console.log(`email[${args.tag}] sending to complained address ${args.to} — critical mail exemption`)
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
