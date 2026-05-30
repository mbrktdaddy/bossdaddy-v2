import * as React from 'react'

interface Props {
  /** Display names of members with unread messages (already de-duped). */
  senderNames: string[]
  /** Total conversations with unread messages (for the "and N more" framing). */
  conversationCount: number
  messagesUrl: string          // /account/messages
  manageUrl:   string          // /account/settings (toggle off)
  siteUrl?:    string
}

// Debounced "you have unread messages" digest. Privacy-first by design: sender
// names only, NEVER message content. Sent by the message-emails cron when a
// message has gone unread past the debounce window and the recipient hasn't
// already been emailed for it. One email per recipient, summarizing all senders.
export function NewMessageEmail({
  senderNames,
  conversationCount,
  messagesUrl,
  manageUrl,
  siteUrl = 'https://www.bossdaddylife.com',
}: Props) {
  // "Alex" · "Alex and Sam" · "Alex, Sam, and 2 others"
  const headline = (() => {
    const names = senderNames.slice(0, 2)
    const extra = conversationCount - names.length
    let who: string
    if (senderNames.length === 1) who = senderNames[0]
    else if (senderNames.length === 2) who = `${names[0]} and ${names[1]}`
    else who = `${names.join(', ')}, and ${extra} other${extra === 1 ? '' : 's'}`
    return `You have unread messages from ${who}.`
  })()

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
                      Messages
                    </p>
                    <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
                      {headline}
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
                      Open Boss Daddy to read and reply. We keep the message itself private — you&apos;ll
                      find it waiting in your inbox.
                    </p>

                    <table cellPadding={0} cellSpacing={0} style={{ margin: '8px 0 0 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '8px' }}>
                          <a
                            href={messagesUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: '#ffffff', fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Open Messages →
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
                      <a href={manageUrl} style={{ color: '#9ca3af' }}>Turn off message emails</a>
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
