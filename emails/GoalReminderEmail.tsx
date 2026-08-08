import * as React from 'react'

interface Props {
  goalTitle:    string
  eyebrow:      string          // "Quit smoking · Morning check-in"
  headline:     string          // kind-aware, from reminderCopy()
  detail:       string
  shiftedNote:  string | null   // set only when a DST gap moved this occurrence
  actionUrl:    string          // the signed one-tap link
  manageUrl:    string
  siteUrl?:     string
}

// Reminder for one goal occurrence. Deliberately quiet: one thing to do, one
// button, no progress bars and no streak talk. Cessation and medication are
// edge-off topics (brand-guide §1.6) and this template is shared with them.
//
// Plain HTML tables, no @react-email/components — that dependency isn't
// installed and importing it makes the render fail silently at send time.
export function GoalReminderEmail({
  goalTitle,
  eyebrow,
  headline,
  detail,
  shiftedNote,
  actionUrl,
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
                      {eyebrow}
                    </p>
                    <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
                      {headline}
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                      {detail}
                    </p>

                    {shiftedNote ? (
                      <p style={{ color: '#f48a4a', fontSize: '13px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                        {shiftedNote}
                      </p>
                    ) : null}

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={actionUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Log it →
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
                      Too many? <a href={manageUrl} style={{ color: '#9ca3af' }}>Change reminders for {goalTitle}</a>
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
