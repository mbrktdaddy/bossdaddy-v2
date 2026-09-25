import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

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
export function GoalReminderEmail({
  goalTitle,
  eyebrow,
  headline,
  detail,
  shiftedNote,
  actionUrl,
  manageUrl,
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          Boss Daddy Life · <a href={siteUrl} style={footerLink}>bossdaddylife.com</a><br/>
          Too many? <a href={manageUrl} style={{ ...footerLink, textDecoration: 'underline' }}>Change reminders for {goalTitle}</a>
        </p>
      }
    >
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

      <EmailButton href={actionUrl}>Log it →</EmailButton>
    </EmailLayout>
  )
}
