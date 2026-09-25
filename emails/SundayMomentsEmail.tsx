import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

interface Props {
  kidName: string | null
  captureUrl: string
  unsubscribeUrl: string
  email: string
  siteUrl?: string
}

// Sunday-night moments prompt. Quiet, one CTA, easy to turn off.
export function SundayMomentsEmail({
  kidName,
  captureUrl,
  unsubscribeUrl,
  email,
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  const who = kidName?.trim() || 'them'

  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={footerText}>
            Sent to {email}.{' '}
            <a href={unsubscribeUrl} style={{ ...footerLink, textDecoration: 'underline' }}>
              Turn this off
            </a>
            .
          </p>
          <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
            <a href={siteUrl} style={{ color: '#4b5563', textDecoration: 'none' }}>
              BossDaddyLife.com
            </a>
          </p>
        </>
      }
    >
      <h1 style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3 }}>
        How was this weekend with {who}?
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: 1.6, margin: '0 0 24px 0' }}>
        One thing worth remembering. Thirty seconds. That&apos;s it.
      </p>

      <EmailButton href={captureUrl}>Capture a moment →</EmailButton>

      <p style={{ color: '#6b7280', fontSize: '13px', lineHeight: 1.6, margin: '32px 0 0 0' }}>
        Skip it this week if you&apos;re busy. We&apos;ll be here next Sunday.
      </p>
    </EmailLayout>
  )
}
