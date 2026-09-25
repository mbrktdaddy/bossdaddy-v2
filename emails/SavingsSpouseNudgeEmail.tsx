import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

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
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          Boss Daddy Life · <a href={siteUrl} style={footerLink}>bossdaddylife.com</a><br/>
          <a href={manageUrl} style={{ ...footerLink, textDecoration: 'underline' }}>Manage reminders for this goal</a>
        </p>
      }
    >
      <p style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px 0' }}>
        Savings · {goalName}
      </p>
      <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
        {partnerName}{' '}hasn&apos;t logged today — want to cover it?
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
        The goal is at <strong style={{ color: '#ffffff' }}>{totalSavedLabel}</strong>. {amountLabel} from you keeps the streak alive for both of you. Whoever shows up that day, the goal stays on track.
      </p>

      <EmailButton href={goalUrl}>Cover {amountLabel} →</EmailButton>
    </EmailLayout>
  )
}
