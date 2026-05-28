import * as React from 'react'

interface Props {
  kidName: string | null
  weekendsRemaining: number
  previousWeekends: number | null   // a year ago, if we know it
  shareUrl: string
  unsubscribeUrl: string
  email: string
  siteUrl?: string
}

// Yearly Weekends Until check-in. Sent on the anniversary of opt-in.
// Tone: brief, dad-to-dad. No upsell. Just the new number + one CTA.
export function WeekendsCheckinEmail({
  kidName,
  weekendsRemaining,
  previousWeekends,
  shareUrl,
  unsubscribeUrl,
  email,
  siteUrl = 'https://www.bossdaddylife.com',
}: Props) {
  const who = kidName?.trim() || 'your kid'
  const diff = previousWeekends != null ? previousWeekends - weekendsRemaining : null

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
                  <td style={{ backgroundColor: '#111114', padding: '24px 40px', borderBottom: '1px solid #222226' }}>
                    <p style={{ margin: 0, color: '#CC5500', fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                      BOSS DADDY LIFE
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style={{ padding: '40px' }}>
                    <p style={{ color: '#71717a', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '0 0 16px 0' }}>
                      Yearly check-in
                    </p>

                    <p style={{ color: '#CC5500', fontSize: '88px', fontWeight: 900, margin: '0 0 8px 0', lineHeight: 1 }}>
                      {weekendsRemaining.toLocaleString()}
                    </p>
                    <p style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.3 }}>
                      weekends left with {who}.
                    </p>

                    {diff != null && diff > 0 && (
                      <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 24px 0' }}>
                        That&apos;s {diff} fewer than this time last year.
                      </p>
                    )}

                    <p style={{ color: '#d4d4d8', fontSize: '15px', lineHeight: 1.6, margin: '24px 0' }}>
                      One year ago you wanted a check-in. Here it is.
                      Nothing to do. Just the number.
                    </p>

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '24px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={shareUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            See the full picture →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '24px 40px', borderTop: '1px solid #1f1f1f' }}>
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
                      Sent to {email}. One email a year, that&apos;s it.{' '}
                      <a href={unsubscribeUrl} style={{ color: '#6b7280', textDecoration: 'underline' }}>
                        Unsubscribe
                      </a>
                      .
                    </p>
                    <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
                      <a href={siteUrl} style={{ color: '#4b5563', textDecoration: 'none' }}>
                        BossDaddyLife.com
                      </a>
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
