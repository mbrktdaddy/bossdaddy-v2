import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

interface Props {
  goalName:        string
  amountLabel:     string         // e.g. "$2"
  cadenceLabel:    string         // e.g. "today" / "this week" / "this month"
  totalSavedLabel: string         // e.g. "$184"
  streakLabel:     string | null  // e.g. "5-day streak" or null when no streak
  goalUrl:         string
  manageUrl:       string         // /tools/savings/[id]/edit#reminders
  siteUrl?:        string
}

// Periodic reminder per goal cadence. Quiet copy — the streak/banked
// info lives on the goal page; the email is just the nudge.
export function SavingsReminderEmail({
  goalName,
  amountLabel,
  cadenceLabel,
  totalSavedLabel,
  streakLabel,
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
          Too many? <a href={manageUrl} style={{ ...footerLink, textDecoration: 'underline' }}>Turn off reminders for this goal</a>
        </p>
      }
    >
      <p style={{ color: '#9ca3af', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700, margin: '0 0 8px 0' }}>
        Savings · {goalName}
      </p>
      <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
        Time for {amountLabel} {cadenceLabel}.
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
        You&apos;re at <strong style={{ color: '#ffffff' }}>{totalSavedLabel}</strong> toward this goal{streakLabel ? <> · <span style={{ color: '#CC5500' }}>{streakLabel}</span></> : null}. Tap below to log {amountLabel} and keep the streak.
      </p>

      <EmailButton href={goalUrl}>Log {amountLabel} →</EmailButton>
    </EmailLayout>
  )
}
