import * as React from 'react'

interface Props {
  kidName: string | null
  captureUrl: string
  unsubscribeUrl: string
  email: string
  siteUrl?: string
}

// Sunday-night moments prompt. Quiet, one CTA, easy to turn off.
export function SundayMomentsEmail({
  kidName,
  captureUrl,
  unsubscribeUrl,
  email,
  siteUrl = 'https://www.bossdaddylife.com',
}: Props) {
  const who = kidName?.trim() || 'them'

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
                    <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
                      How was this weekend with {who}?
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                      One thing worth remembering. Thirty seconds. That&apos;s it.
                    </p>

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={captureUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Capture a moment →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.6, margin: '32px 0 0 0' }}>
                      Skip it this week if you&apos;re busy. We&apos;ll be here next Sunday.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '24px 40px', borderTop: '1px solid #1f1f1f' }}>
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
                      Sent to {email}.{' '}
                      <a href={unsubscribeUrl} style={{ color: '#6b7280', textDecoration: 'underline' }}>
                        Turn this off
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
