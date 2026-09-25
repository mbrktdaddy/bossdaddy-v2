import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

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
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <p style={footerText}>
          Boss Daddy Life · <a href={siteUrl} style={footerLink}>bossdaddylife.com</a>
        </p>
      }
    >
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

      <EmailButton href={acceptUrl}>Join the goal →</EmailButton>

      <p style={{ color: '#6b7280', fontSize: '12px', margin: '24px 0 0 0', lineHeight: 1.5 }}>
        Link expires in 7 days. If you don&apos;t know {inviterName}, you can ignore this email — the invite will quietly expire.
      </p>
    </EmailLayout>
  )
}
