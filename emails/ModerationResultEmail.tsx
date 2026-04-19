import * as React from 'react'

type Action = 'approve' | 'reject' | 'request_edits'
type ContentType = 'review' | 'article'

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
    <html>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </head>
      <body style={{ backgroundColor: '#0a0a0a', margin: 0, padding: 0, fontFamily: 'Arial, sans-serif' }}>
        <table width='100%' cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#0a0a0a', padding: '40px 20px' }}>
          <tr>
            <td align='center'>
              <table width='560' cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#111111', borderRadius: '12px', overflow: 'hidden', maxWidth: '560px', width: '100%' }}>

                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: '#1a0800', padding: '32px 40px', borderBottom: '1px solid #2a1000' }}>
                    <p style={{ margin: 0, color: '#CC5500', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                      BOSS DADDY LIFE
                    </p>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '40px' }}>
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

                    {/* CTA */}
                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={dashboardUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            {action === 'approve' ? 'View Your Dashboard →' : 'Go to Dashboard →'}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '24px 40px', borderTop: '1px solid #1f1f1f' }}>
                    <p style={{ color: '#4b5563', fontSize: '12px', margin: '0 0 8px 0', lineHeight: '1.6' }}>
                      <a href={siteUrl} style={{ color: '#6b7280', textDecoration: 'none' }}>BossDaddyLife.com</a>
                      {' · '}
                      <a href='https://x.com/bossdaddylife' style={{ color: '#6b7280', textDecoration: 'none' }}>@bossdaddylife on X</a>
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
