import * as React from 'react'
import { EmailLayout, EmailButton, EMAIL_COLORS as C, footerText, footerLink } from './_components/EmailLayout'

export type AccountStatusEvent =
  | 'suspended'
  | 'banned'
  | 'admin_delete_scheduled'
  | 'self_delete_scheduled'
  | 'restored'
  | 'hard_deleted'
  | 'promoted_to_author'
  | 'demoted_to_member'

interface Props {
  event: AccountStatusEvent
  username: string
  siteUrl: string
  /** Reason supplied by the admin (or by the user for self-delete). Optional. */
  reason?: string | null
  /** Suspension end date, formatted (e.g. "May 15, 2026"). Required for `suspended`. */
  suspensionEndsOn?: string | null
  /** Hard-delete date, formatted. Required for `*_delete_scheduled`. */
  deletionDate?: string | null
}

const CONFIG: Record<AccountStatusEvent, {
  subject: string
  headline: string
  subtext: string
  color: string
  cta: { label: string; path: string } | null
}> = {
  suspended: {
    subject: 'Your Boss Daddy account has been suspended',
    headline: 'Account suspended',
    subtext: "Your account is temporarily on hold and you can't sign in until the suspension ends.",
    color: '#92400e',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:support@bossdaddylife.com?subject=Suspension%20question' },
  },
  banned: {
    subject: 'Your Boss Daddy account has been banned',
    headline: 'Account banned',
    subtext: "Your account has been permanently banned from Boss Daddy. If you believe this is a mistake, reach out and we'll take a look.",
    color: '#b91c1c',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:support@bossdaddylife.com?subject=Ban%20appeal' },
  },
  admin_delete_scheduled: {
    subject: 'Your Boss Daddy account is scheduled for deletion',
    headline: 'Deletion scheduled',
    subtext: 'An administrator has scheduled your account for permanent deletion. You can sign in to cancel this within the cooldown window.',
    color: '#b91c1c',
    cta: { label: 'Sign in to cancel →', path: '/login' },
  },
  self_delete_scheduled: {
    subject: "We've received your account deletion request",
    headline: "Your deletion is scheduled",
    subtext: "Sorry to see you go. Your account will be permanently deleted after the 30-day cooldown. You can cancel any time by signing back in.",
    color: '#92400e',
    cta: { label: 'Sign in to cancel →', path: '/login' },
  },
  restored: {
    subject: 'Welcome back to Boss Daddy',
    headline: "You're back, Boss",
    subtext: 'Your account is active again. Pick up where you left off.',
    color: '#15803d',
    cta: { label: 'Open dashboard →', path: '/dashboard' },
  },
  hard_deleted: {
    subject: 'Your Boss Daddy account has been deleted',
    headline: 'Account deleted',
    subtext: 'As requested, your account and all associated data have been permanently removed from Boss Daddy. This action is irreversible.',
    color: '#52525b',
    cta: null,
  },
  promoted_to_author: {
    subject: "You're a Boss Daddy author now",
    headline: "You're an author now, Boss",
    subtext: 'Boss Daddy promoted you to author. The workspace is open — start drafting reviews, guides, and collections that ship under your byline.',
    color: '#15803d',
    cta: { label: 'Open the workspace →', path: '/dashboard' },
  },
  demoted_to_member: {
    subject: 'Your Boss Daddy author privileges have been removed',
    headline: 'Author privileges removed',
    subtext: 'Your author access has been removed. Your account stays active — you can still read, comment, and use every member feature. The workspace is no longer available.',
    color: '#92400e',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:support@bossdaddylife.com?subject=Author%20privileges%20question' },
  },
}

export function AccountStatusEmail({ event, username, siteUrl, reason, suspensionEndsOn, deletionDate }: Props) {
  const cfg = CONFIG[event]
  const ctaHref = cfg.cta
    ? cfg.cta.path.startsWith('http') || cfg.cta.path.startsWith('mailto:')
      ? cfg.cta.path
      : `${siteUrl}${cfg.cta.path}`
    : null

  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={{ ...footerText, margin: '0 0 8px 0' }}>
            Questions? <a href='mailto:support@bossdaddylife.com' style={{ ...footerLink, textDecoration: 'underline' }}>support@bossdaddylife.com</a>
          </p>
          <p style={footerText}>
            <a href={siteUrl} style={footerLink}>BossDaddyLife.com</a>
          </p>
        </>
      }
    >
      <h1 style={{ color: C.heading, fontSize: '24px', fontWeight: 900, margin: '0 0 12px 0', lineHeight: '1.2' }}>
        {cfg.headline}
      </h1>
      <p style={{ color: C.heading, fontSize: '15px', margin: '0 0 16px 0' }}>
        Hey @{username},
      </p>
      <p style={{ color: C.text, fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
        {cfg.subtext}
      </p>

      {(suspensionEndsOn || deletionDate) && (
        <div style={{ backgroundColor: C.footer, border: `1px solid ${C.line}`, borderRadius: '4px', padding: '12px 16px', marginBottom: '20px' }}>
          <p style={{ color: C.faint, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>
            {event === 'suspended' ? 'Suspension ends' : 'Final deletion date'}
          </p>
          <p style={{ color: C.heading, fontSize: '15px', fontWeight: 700, margin: 0 }}>
            {suspensionEndsOn ?? deletionDate}
          </p>
        </div>
      )}

      {reason && (
        <div style={{ backgroundColor: C.footer, border: `1px solid ${C.line}`, borderLeft: `4px solid ${cfg.color}`, borderRadius: '4px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ color: cfg.color, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
            Reason
          </p>
          <p style={{ color: C.text, fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            {reason}
          </p>
        </div>
      )}

      {cfg.cta && ctaHref && (
        <EmailButton href={ctaHref} style={{ margin: '8px 0' }}>{cfg.cta.label}</EmailButton>
      )}
    </EmailLayout>
  )
}
