import * as React from 'react'

type WishlistStatus = 'queued' | 'testing' | 'reviewed'

interface Props {
  status: WishlistStatus
  itemTitle: string
  itemSlug: string
  itemImageUrl?: string | null
  reviewSlug?: string | null  // only present for 'reviewed' status
  siteUrl: string
  unsubscribeToken?: string | null
}

const CONFIG: Record<WishlistStatus, {
  subject: (title: string) => string
  eyebrow: string
  headline: string
  subtext: string
  cta: string
  ctaPath: (item: { slug: string; reviewSlug?: string | null }) => string
  accent: string
}> = {
  queued: {
    subject: (t) => `Your vote moved ${t} up the list`,
    eyebrow: 'ON DECK',
    headline: 'Your vote bumped this up',
    subtext: 'Thanks for the input — this one\'s moved up the queue. Boss Daddy is picking it up soon for real-world testing.',
    cta: 'See where it stands',
    ctaPath: (item) => `/bench/${item.slug}`,
    accent: '#60a5fa',
  },
  testing: {
    subject: (t) => `I'm testing ${t} this week`,
    eyebrow: 'TESTING NOW',
    headline: 'Hands on it this week',
    subtext: 'Boss Daddy is putting this through real-world use. The honest verdict — pros, cons, whether it\'s worth the money — is coming in 2–3 weeks.',
    cta: 'Watch progress',
    ctaPath: (item) => `/bench/${item.slug}`,
    accent: '#4ade80',
  },
  reviewed: {
    subject: (t) => `Review of ${t} is live`,
    eyebrow: 'REVIEW LIVE',
    headline: 'The review is up',
    subtext: 'You asked to be notified when this dropped. Here\'s the honest, dad-tested verdict.',
    cta: 'Read the review',
    ctaPath: (item) => item.reviewSlug ? `/reviews/${item.reviewSlug}` : `/bench/${item.slug}`,
    accent: '#CC5500',
  },
}

export function WishlistStatusEmail({ status, itemTitle, itemSlug, itemImageUrl, reviewSlug, siteUrl, unsubscribeToken }: Props) {
  const cfg = CONFIG[status]
  const ctaUrl = `${siteUrl}${cfg.ctaPath({ slug: itemSlug, reviewSlug })}`
  const benchUrl = `${siteUrl}/bench/${itemSlug}`
  const unsubscribeUrl = unsubscribeToken ? `${siteUrl}/api/wishlist/unsubscribe?token=${unsubscribeToken}` : null

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{ backgroundColor: '#0a0a0a', margin: 0, padding: 0, fontFamily: '-apple-system, BlinkMacSystemFont, Arial, sans-serif' }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#0a0a0a', padding: '40px 16px' }}>
          <tr>
            <td align="center">
              <table width="480" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#141414', borderRadius: '16px', overflow: 'hidden', maxWidth: '480px', width: '100%', border: '1px solid #2a2a2a' }}>

                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: '#111114', padding: '20px 28px', borderBottom: '1px solid #222226' }}>
                    <table cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ paddingRight: '12px', verticalAlign: 'middle' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`${siteUrl}/images/bd-logo-badge.png`}
                            alt="Boss Daddy"
                            width={36}
                            height={36}
                            style={{ display: 'block' }}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <p style={{ margin: 0, fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px', color: '#ffffff' }}>
                            <span style={{ color: '#CC5500' }}>BOSS</span> DADDY
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Body */}
                <tr>
                  <td style={{ padding: '32px 28px' }}>
                    <p style={{
                      margin: '0 0 12px 0',
                      color: cfg.accent,
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                    }}>
                      — {cfg.eyebrow}
                    </p>

                    <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 900, color: '#ffffff', lineHeight: 1.2 }}>
                      {cfg.headline}
                    </h1>

                    <p style={{ margin: '0 0 24px 0', fontSize: '15px', color: '#a1a1a1', lineHeight: 1.6 }}>
                      {cfg.subtext}
                    </p>

                    {/* Item card */}
                    <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', marginBottom: '24px' }}>
                      <tr>
                        {itemImageUrl && (
                          <td width="80" style={{ padding: '12px 0 12px 12px', verticalAlign: 'middle' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={itemImageUrl}
                              alt={itemTitle}
                              width={64}
                              height={64}
                              style={{ display: 'block', width: '64px', height: '64px', objectFit: 'contain', backgroundColor: '#0a0a0a', borderRadius: '8px' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
                          <p style={{ margin: '0 0 2px 0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
                            On the Bench
                          </p>
                          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
                            {itemTitle}
                          </p>
                        </td>
                      </tr>
                    </table>

                    {/* CTA */}
                    <table cellPadding={0} cellSpacing={0} style={{ margin: '0 0 8px 0' }}>
                      <tr>
                        <td style={{ backgroundColor: '#CC5500', borderRadius: '10px' }}>
                          <a
                            href={ctaUrl}
                            style={{
                              display: 'inline-block',
                              padding: '14px 28px',
                              color: '#ffffff',
                              fontWeight: 700,
                              fontSize: '15px',
                              textDecoration: 'none',
                              minHeight: '24px',
                            }}
                          >
                            {cfg.cta} →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ borderTop: '1px solid #2a2a2a', padding: '20px 28px' }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#6b6b6b', lineHeight: 1.6 }}>
                      You&apos;re receiving this because you asked to be notified about <a href={benchUrl} style={{ color: '#9ca3af', textDecoration: 'underline' }}>{itemTitle}</a> on the Boss Daddy bench.
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b6b6b' }}>
                      <a href={`${siteUrl}/account/settings`} style={{ color: '#9ca3af', textDecoration: 'underline' }}>Manage notifications</a>
                      {unsubscribeUrl && (
                        <>
                          {' · '}
                          <a href={unsubscribeUrl} style={{ color: '#9ca3af', textDecoration: 'underline' }}>Unsubscribe</a>
                        </>
                      )}
                      {' · '}
                      <a href={siteUrl} style={{ color: '#9ca3af', textDecoration: 'none' }}>BossDaddyLife.com</a>
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

export function getWishlistStatusSubject(status: WishlistStatus, itemTitle: string): string {
  return CONFIG[status].subject(itemTitle)
}
