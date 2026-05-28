import * as React from 'react'

interface Props {
  goalName:        string
  amountLabel:     string         // e.g. "$2"
  partnerName:     string         // e.g. "@mark" — who hasn't logged yet
  totalSavedLabel: string
  goalUrl:         string
  manageUrl:       string
  siteUrl?:        string
}

// Sent end-of-day on multi-participant DAILY goals where no one has logged
// today. Gentle nudge — frames as teamwork ("want to cover it?"), not
// surveillance. Only fires when the goal has 0 contributions today.
export function SavingsSpouseNudgeEmail({
  goalName,
  amountLabel,
  partnerName,
  totalSavedLabel,
  goalUrl,
  manageUrl,
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
                      Savings · {goalName}
                    </p>
                    <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
                      {partnerName} hasn&apos;t logged today — want to cover it?
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                      The goal is at <strong style={{ color: '#ffffff' }}>{totalSavedLabel}</strong>. {amountLabel} from you keeps the streak alive for both of you. Whoever shows up that day, the goal stays on track.
                    </p>

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={goalUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Cover {amountLabel} →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style={{ backgroundColor: '#0a0a0a', padding: '20px 40px', borderTop: '1px solid #222226' }}>
                    <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
                      Boss Daddy Life · <a href={siteUrl} style={{ color: '#9ca3af', textDecoration: 'none' }}>bossdaddylife.com</a><br/>
                      <a href={manageUrl} style={{ color: '#9ca3af' }}>Manage reminders for this goal</a>
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
