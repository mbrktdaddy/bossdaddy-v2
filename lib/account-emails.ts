import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { AccountStatusEmail, type AccountStatusEvent } from '@/emails/AccountStatusEmail'
import * as React from 'react'

const SUBJECTS: Record<AccountStatusEvent, string> = {
  suspended:               'Your Boss Daddy account has been suspended',
  banned:                  'Your Boss Daddy account has been banned',
  admin_delete_scheduled:  'Your Boss Daddy account is scheduled for deletion',
  self_delete_scheduled:   "We've received your account deletion request",
  restored:                'Welcome back to Boss Daddy',
  hard_deleted:            'Your Boss Daddy account has been deleted',
}

interface SendArgs {
  userId: string
  event: AccountStatusEvent
  reason?: string | null
  /** ISO timestamp — formatted into "May 15, 2026" before sending. */
  suspendedUntilIso?: string | null
  /** ISO timestamp — formatted before sending. */
  deletionDateIso?: string | null
}

/**
 * Sends one of the moderation-related account emails. Looks up the user's
 * email + username via the admin client, then fires through Resend. All
 * failures are logged but don't throw — caller can fire-and-forget.
 *
 * Hard-delete is a special case: the cron passes a captured email/username
 * directly via sendAccountStatusEmailDirect since the auth.users row is
 * about to disappear and we can't look it up afterwards.
 */
export async function sendAccountStatusEmail(args: SendArgs): Promise<void> {
  const admin = createAdminClient()

  const [{ data: profile }, authUser] = await Promise.all([
    admin.from('profiles').select('username').eq('id', args.userId).single(),
    admin.auth.admin.getUserById(args.userId),
  ])

  const email = authUser.data.user?.email
  const username = profile?.username
  if (!email || !username) {
    console.error('account-emails: missing email or username for', args.userId, { email, username })
    return
  }

  await sendAccountStatusEmailDirect({
    to: email,
    username,
    event: args.event,
    reason: args.reason ?? null,
    suspendedUntilIso: args.suspendedUntilIso ?? null,
    deletionDateIso: args.deletionDateIso ?? null,
  })
}

interface DirectArgs {
  to: string
  username: string
  event: AccountStatusEvent
  reason?: string | null
  suspendedUntilIso?: string | null
  deletionDateIso?: string | null
}

export async function sendAccountStatusEmailDirect(args: DirectArgs): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const fmt = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null

  await sendEmail({
    to:      args.to,
    subject: SUBJECTS[args.event],
    tag:     `account_${args.event}`,
    react: React.createElement(AccountStatusEmail, {
      event:            args.event,
      username:         args.username,
      siteUrl,
      reason:           args.reason ?? null,
      suspensionEndsOn: fmt(args.suspendedUntilIso),
      deletionDate:     fmt(args.deletionDateIso),
    }),
  })
}
