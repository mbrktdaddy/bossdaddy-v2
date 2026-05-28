import * as React from 'react'

interface Props {
  inviterName:    string         // e.g. "@mark" or "Mark"
  goalName:       string
  acceptUrl:      string
  siteUrl?:       string
}

// Sent when an owner generates an invite and includes a recipient email.
// Single clear CTA — recipient signs up/in then auto-accepts on return.
export function SavingsInviteEmail({
  inviterName,
  goalName,
  acceptUrl,
  siteUrl = 'https://www.bossdaddylife.com',
}: Props) {
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
                    <p style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px 0' }}>
                      You&apos;re invited
                    </p>
                    <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
                      {inviterName} added you to a savings goal.
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                      Goal: <strong style={{ color: '#ffffff' }}>{goalName}</strong>
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                      Boss Daddy&apos;s Savings tool turns long-term goals into a tiny daily habit. You and {inviterName} both contribute — whoever shows up that day keeps the streak.
                    </p>

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={acceptUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Join the goal →
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style={{ color: '#6b7280', fontSize: '12px', margin: '24px 0 0 0', lineHeight: 1.5 }}>
                      Link expires in 7 days. If you don&apos;t know {inviterName}, you can ignore this email — the invite will quietly expire.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style={{ backgroundColor: '#0a0a0a', padding: '20px 40px', borderTop: '1px solid #222226' }}>
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                      Boss Daddy Life · <a href={siteUrl} style={{ color: '#9ca3af', textDecoration: 'none' }}>bossdaddylife.com</a>
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
