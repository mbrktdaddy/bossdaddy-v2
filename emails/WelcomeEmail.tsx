import * as React from 'react'
import { BRAND } from '@/lib/brand'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

interface Props {
  email: string
  siteUrl?: string
}

export function WelcomeEmail({ email, siteUrl = DEFAULT_SITE_URL }: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={{ ...footerText, margin: '0 0 12px 0' }}>
            Follow us:{' '}
            <a href='https://x.com/bossdaddylife' style={footerLink}>
              @bossdaddylife on X
            </a>
          </p>
          <p style={footerText}>
            You&apos;re receiving this because you signed up at BossDaddyLife.com.<br />
            <a href={siteUrl} style={footerLink}>
              BossDaddyLife.com
            </a>
            {' · '}
            <a href={`${siteUrl}/affiliate-disclosure`} style={footerLink}>
              Affiliate Disclosure
            </a>
          </p>
          <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
            Sent to {email}
          </p>
        </>
      }
    >
      <h1 style={{ color: '#ffffff', fontSize: '28px', fontWeight: 900, margin: '0 0 16px 0', lineHeight: '1.2' }}>
        You&apos;re in, Boss. 🔥
      </h1>
      <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
        Welcome to the crew. You just signed up for the only newsletter that tells you exactly which gear is worth your hard-earned money — and which ones are straight garbage.
      </p>
      <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
        No sponsored posts. No affiliate pressure. Just a real dad who buys the stuff, tests it on weekends, and gives you the honest verdict.
      </p>
      <p style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.6', margin: '0 0 24px 0' }}>
        Quick on the why: I&apos;m a first-time dad who decided that showing up — strong, present, every single day — isn&apos;t a compromise of my strength. It&apos;s the ultimate expression of it. That&apos;s {BRAND.positioning}, and if you&apos;re reading this, you already live it.{' '}
        <a href={`${siteUrl}/about`} style={{ color: '#CC5500', textDecoration: 'none', fontWeight: 700 }}>The whole story →</a>
      </p>

      <EmailButton href={`${siteUrl}/reviews`} style={{ margin: '32px 0' }}>Browse Dad-Tested Reviews →</EmailButton>

      <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
        Real talk: I only email when I have something worth saying. No weekly fluff, no daily spam. Just the good stuff.
      </p>
      <p style={{ color: '#CC5500', fontWeight: 800, fontSize: '16px', margin: '28px 0 2px 0' }}>{BRAND.tagline}</p>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>— The Boss</p>
    </EmailLayout>
  )
}
