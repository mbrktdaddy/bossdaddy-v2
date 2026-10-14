import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL, EMAIL_COLORS as C } from './_components/EmailLayout'

interface Props {
  kidName: string | null
  weekendsRemaining: number
  previousWeekends: number | null   // a year ago, if we know it
  shareUrl: string
  unsubscribeUrl: string
  email: string
  siteUrl?: string
}

// Yearly Weekends Until check-in. Sent on the anniversary of opt-in.
// Tone: brief, dad-to-dad. No upsell. Just the new number + one CTA.
export function WeekendsCheckinEmail({
  kidName,
  weekendsRemaining,
  previousWeekends,
  shareUrl,
  unsubscribeUrl,
  email,
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  const who = kidName?.trim() || 'your kid'
  const diff = previousWeekends != null ? previousWeekends - weekendsRemaining : null

  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={footerText}>
            Sent to {email}. One email a year, that&apos;s it.{' '}
            <a href={unsubscribeUrl} style={{ ...footerLink, textDecoration: 'underline' }}>
              Unsubscribe
            </a>
            .
          </p>
          <p style={{ color: C.faint, fontSize: '11px', margin: '8px 0 0 0' }}>
            <a href={siteUrl} style={{ color: C.faint, textDecoration: 'none' }}>
              BossDaddyLife.com
            </a>
          </p>
        </>
      }
    >
      <p style={{ color: C.faint, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '0 0 16px 0' }}>
        Yearly check-in
      </p>

      <p style={{ color: C.link, fontSize: '88px', fontWeight: 900, margin: '0 0 8px 0', lineHeight: 1 }}>
        {weekendsRemaining.toLocaleString()}
      </p>
      <p style={{ color: C.heading, fontSize: '20px', fontWeight: 700, margin: '0 0 8px 0', lineHeight: 1.3 }}>
        weekends left with {who}.
      </p>

      {diff != null && diff > 0 && (
        <p style={{ color: C.text, fontSize: '14px', margin: '0 0 24px 0' }}>
          That&apos;s {diff} fewer than this time last year.
        </p>
      )}

      <p style={{ color: C.text, fontSize: '15px', lineHeight: 1.6, margin: '24px 0' }}>
        One year ago you wanted a check-in. Here it is.
        Nothing to do. Just the number.
      </p>

      <EmailButton href={shareUrl} style={{ margin: '24px 0 0 0' }}>See the full picture →</EmailButton>
    </EmailLayout>
  )
}
