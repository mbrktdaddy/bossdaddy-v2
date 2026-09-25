import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink } from './_components/EmailLayout'

type Action = 'approve' | 'reject' | 'request_edits'
type ContentType = 'review' | 'guide'

interface Props {
  action: Action
  contentType: ContentType
  title: string
  reason?: string
  siteUrl: string
}

const CONFIG: Record<Action, { subject: string; headline: string; subtext: string; color: string; bgColor: string }> = {
  approve: {
    subject: '🎉 Your content is live on Boss Daddy Life',
    headline: "You're live, Boss!",
    subtext: 'Your content has been approved and is now published on Boss Daddy Life.',
    color: '#4ade80',
    bgColor: '#052e16',
  },
  reject: {
    subject: 'Update on your Boss Daddy submission',
    headline: 'Your submission needs attention',
    subtext: "We reviewed your content and unfortunately it wasn't a fit this time. See the reason below.",
    color: '#f87171',
    bgColor: '#2d0c0c',
  },
  request_edits: {
    subject: 'Edits requested on your Boss Daddy submission',
    headline: 'A few changes needed',
    subtext: "Good news — your content is close. We just need a few changes before it can go live.",
    color: '#fbbf24',
    bgColor: '#1c1100',
  },
}

export function ModerationResultEmail({ action, contentType, title, reason, siteUrl }: Props) {
  const cfg = CONFIG[action]
  const dashboardUrl = `${siteUrl}/dashboard/${contentType}s`

  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          <a href={siteUrl} style={footerLink}>BossDaddyLife.com</a>
          {' · '}
          <a href='https://x.com/bossdaddylife' style={footerLink}>@bossdaddylife on X</a>
        </p>
      }
    >
      <h1 style={{ color: cfg.color, fontSize: '24px', fontWeight: 900, margin: '0 0 12px 0', lineHeight: '1.2' }}>
        {cfg.headline}
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
        {cfg.subtext}
      </p>

      {/* Content title pill */}
      <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', marginBottom: '24px' }}>
        <p style={{ color: '#6b7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>
          {contentType === 'review' ? 'Review' : 'Article'}
        </p>
        <p style={{ color: '#e5e7eb', fontSize: '14px', fontWeight: 600, margin: 0 }}>
          {title}
        </p>
      </div>

      {/* Reason box */}
      {reason && (
        <div style={{ backgroundColor: cfg.bgColor, border: `1px solid ${cfg.color}30`, borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <p style={{ color: cfg.color, fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px 0' }}>
            {action === 'request_edits' ? 'Changes needed' : 'Reason'}
          </p>
          <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
            {reason}
          </p>
        </div>
      )}

      <EmailButton href={dashboardUrl} style={{ margin: '8px 0' }}>
        {action === 'approve' ? 'View Your Dashboard →' : 'Go to Dashboard →'}
      </EmailButton>
    </EmailLayout>
  )
}
