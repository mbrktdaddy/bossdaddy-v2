import * as React from 'react'

interface Props {
  email: string
}

export function WelcomeEmail({ email }: Props) {
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
                    <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 900, margin: '0 0 16px 0', lineHeight: '1.2' }}>
                      You&apos;re in, Boss. 🔥
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                      Welcome to the crew. You just signed up for the only newsletter that tells you exactly which gear is worth your hard-earned money — and which ones are straight garbage.
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
                      No sponsored posts. No affiliate pressure. Just a real dad who buys the stuff, tests it on weekends, and gives you the honest verdict.
                    </p>

                    {/* CTA */}
                    <table cellPadding={0} cellSpacing={0} style={{ margin: '32px 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href='https://bossdaddylife.com/reviews'
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Browse Dad-Tested Reviews →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                      Real talk: I only email when I have something worth saying. No weekly fluff, no daily spam. Just the good stuff.
                    </p>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '24px 40px', borderTop: '1px solid #1f1f1f' }}>
                    <p style={{ color: '#4b5563', fontSize: '12px', margin: '0 0 12px 0', lineHeight: '1.6' }}>
                      Follow us:{' '}
                      <a href='https://x.com/bossdaddylife' style={{ color: '#6b7280', textDecoration: 'none' }}>
                        @bossdaddylife on X
                      </a>
                    </p>
                    <p style={{ color: '#4b5563', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                      You&apos;re receiving this because you signed up at BossDaddyLife.com.<br />
                      <a href='https://bossdaddylife.com' style={{ color: '#6b7280', textDecoration: 'none' }}>
                        BossDaddyLife.com
                      </a>
                      {' · '}
                      <a href='https://bossdaddylife.com/affiliate-disclosure' style={{ color: '#6b7280', textDecoration: 'none' }}>
                        Affiliate Disclosure
                      </a>
                    </p>
                    <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
                      Sent to {email}
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
