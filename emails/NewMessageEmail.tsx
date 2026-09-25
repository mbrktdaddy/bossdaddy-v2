import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

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
  siteUrl = DEFAULT_SITE_URL,
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
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          Boss Daddy Life · <a href={siteUrl} style={footerLink}>bossdaddylife.com</a><br/>
          <a href={manageUrl} style={footerLink}>Turn off message emails</a>
        </p>
      }
    >
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

      <EmailButton href={messagesUrl}>Open Messages →</EmailButton>
    </EmailLayout>
  )
}
