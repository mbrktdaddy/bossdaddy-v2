import * as React from 'react'

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
  bgColor: string
  cta: { label: string; path: string } | null
}> = {
  suspended: {
    subject: 'Your Boss Daddy account has been suspended',
    headline: 'Account suspended',
    subtext: "Your account is temporarily on hold and you can't sign in until the suspension ends.",
    color: '#fbbf24',
    bgColor: '#1c1100',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:boss@bossdaddylife.com?subject=Suspension%20question' },
  },
  banned: {
    subject: 'Your Boss Daddy account has been banned',
    headline: 'Account banned',
    subtext: "Your account has been permanently banned from Boss Daddy. If you believe this is a mistake, reach out and we'll take a look.",
    color: '#f87171',
    bgColor: '#2d0c0c',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:boss@bossdaddylife.com?subject=Ban%20appeal' },
  },
  admin_delete_scheduled: {
    subject: 'Your Boss Daddy account is scheduled for deletion',
    headline: 'Deletion scheduled',
    subtext: 'An administrator has scheduled your account for permanent deletion. You can sign in to cancel this within the cooldown window.',
    color: '#f87171',
    bgColor: '#2d0c0c',
    cta: { label: 'Sign in to cancel →', path: '/login' },
  },
  self_delete_scheduled: {
    subject: "We've received your account deletion request",
    headline: "Your deletion is scheduled",
    subtext: "Sorry to see you go. Your account will be permanently deleted after the 30-day cooldown. You can cancel any time by signing back in.",
    color: '#fbbf24',
    bgColor: '#1c1100',
    cta: { label: 'Sign in to cancel →', path: '/login' },
  },
  restored: {
    subject: 'Welcome back to Boss Daddy',
    headline: "You're back, Boss",
    subtext: 'Your account is active again. Pick up where you left off.',
    color: '#4ade80',
    bgColor: '#052e16',
    cta: { label: 'Open dashboard →', path: '/dashboard' },
  },
  hard_deleted: {
    subject: 'Your Boss Daddy account has been deleted',
    headline: 'Account deleted',
    subtext: 'As requested, your account and all associated data have been permanently removed from Boss Daddy. This action is irreversible.',
    color: '#9ca3af',
    bgColor: '#1a1a1a',
    cta: null,
  },
  promoted_to_author: {
    subject: "You're a Boss Daddy author now",
    headline: "You're an author now, Boss",
    subtext: 'Boss Daddy promoted you to author. The workspace is open — start drafting reviews, guides, and collections that ship under your byline.',
    color: '#4ade80',
    bgColor: '#052e16',
    cta: { label: 'Open the workspace →', path: '/dashboard' },
  },
  demoted_to_member: {
    subject: 'Your Boss Daddy author privileges have been removed',
    headline: 'Author privileges removed',
    subtext: 'Your author access has been removed. Your account stays active — you can still read, comment, and use every member feature. The workspace is no longer available.',
    color: '#fbbf24',
    bgColor: '#1c1100',
    cta: { label: 'Contact Boss Daddy →', path: 'mailto:boss@bossdaddylife.com?subject=Author%20privileges%20question' },
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
    <html>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </head>
      <body style={{ backgroundColor: '#0a0a0a', margin: 0, padding: 0, fontFamily: 'Arial, sans-serif' }}>
        <table width='100%' cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#0a0a0a', padding: '40px 20px' }}>
          <tr>
            <td align='center'>
              <table width='560' cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'hidden', maxWidth: '560px', width: '100%' }}>

                <tr>
                  <td style={{ backgroundColor: '#1a0800', padding: '24px 40px', borderBottom: '1px solid #2a1000' }}>
                    <table cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${siteUrl}/images/bd-logo-badge.png`}
                            alt="Boss Daddy"
                            width={36}
                            height={36}
                            style={{ display: 'block' }}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <p style={{ margin: 0, color: '#CC5500', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                            BOSS DADDY LIFE
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '40px' }}>
                    <h1 style={{ color: cfg.color, fontSize: '24px', fontWeight: 900, margin: '0 0 12px 0', lineHeight: '1.2' }}>
                      {cfg.headline}
                    </h1>
                    <p style={{ color: '#d1d5db', fontSize: '15px', margin: '0 0 16px 0' }}>
                      Hey @{username},
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                      {cfg.subtext}
                    </p>

                    {(suspensionEndsOn || deletionDate) && (
                      <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                        <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>
                          {event === 'suspended' ? 'Suspension ends' : 'Final deletion date'}
                        </p>
                        <p style={{ color: '#e5e7eb', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                          {suspensionEndsOn ?? deletionDate}
                        </p>
                      </div>
                    )}

                    {reason && (
                      <div style={{ backgroundColor: cfg.bgColor, border: `1px solid ${cfg.color}30`, borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                        <p style={{ color: cfg.color, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
                          Reason
                        </p>
                        <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                          {reason}
                        </p>
                      </div>
                    )}

                    {cfg.cta && ctaHref && (
                      <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0' }}>
                        <tr>
                          <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                            <a
                              href={ctaHref}
                              style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                            >
                              {cfg.cta.label}
                            </a>
                          </td>
                        </tr>
                      </table>
                    )}
                  </td>
                </tr>

                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '24px 40px', borderTop: '1px solid #1f1f1f' }}>
                    <p style={{ color: '#4b5563', fontSize: '12px', margin: '0 0 8px 0', lineHeight: '1.6' }}>
                      Questions? <a href='mailto:boss@bossdaddylife.com' style={{ color: '#6b7280', textDecoration: 'underline' }}>boss@bossdaddylife.com</a>
                    </p>
                    <p style={{ color: '#4b5563', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                      <a href={siteUrl} style={{ color: '#6b7280', textDecoration: 'none' }}>BossDaddyLife.com</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  )
}
