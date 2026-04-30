import * as React from 'react'

interface DigestItem {
  type: 'review' | 'guide'
  title: string
  slug: string
  excerpt: string | null
  image_url: string | null
  category: string
  rating?: number | null
}

interface Props {
  email: string
  items: DigestItem[]
  weekLabel: string // e.g. "Week of April 22"
  siteUrl?: string
}

const ORANGE = '#CC5500'
const BG     = '#0a0a0a'
const CARD   = '#111111'
const BORDER = '#1f1f1f'
const TEXT   = '#ffffff'
const MUTED  = '#9ca3af'
const FAINT  = '#6b7280'

export function WeeklyDigestEmail({ email, items, weekLabel, siteUrl = 'https://www.bossdaddylife.com' }: Props) {
  const reviews  = items.filter((i) => i.type === 'review')
  const articles = items.filter((i) => i.type === 'guide')

  return (
    <html>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1.0' />
      </head>
      <body style={{ backgroundColor: BG, margin: 0, padding: 0, fontFamily: 'Arial, sans-serif' }}>
        <table width='100%' cellPadding={0} cellSpacing={0} style={{ backgroundColor: BG, padding: '40px 20px' }}>
          <tr>
            <td align='center'>
              <table width='560' cellPadding={0} cellSpacing={0} style={{ backgroundColor: CARD, borderRadius: '12px', overflow: 'hidden', maxWidth: '560px', width: '100%' }}>

                {/* Header */}
                <tr>
                  <td style={{ backgroundColor: '#1a0800', padding: '32px 40px', borderBottom: `1px solid #2a1000` }}>
                    <p style={{ margin: 0, color: ORANGE, fontWeight: 900, fontSize: '20px', letterSpacing: '-0.5px' }}>
                      BOSS DADDY LIFE
                    </p>
                    <p style={{ margin: '4px 0 0 0', color: FAINT, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                      {weekLabel}
                    </p>
                  </td>
                </tr>

                {/* Intro */}
                <tr>
                  <td style={{ padding: '36px 40px 16px 40px' }}>
                    <h1 style={{ color: TEXT, fontSize: '24px', fontWeight: 900, margin: '0 0 12px 0', lineHeight: '1.2' }}>
                      What dropped this week
                    </h1>
                    <p style={{ color: MUTED, fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                      {items.length === 1
                        ? "One new piece this week. Worth your time."
                        : `${items.length} new pieces this week. The good stuff first.`}
                    </p>
                  </td>
                </tr>

                {/* Review section */}
                {reviews.length > 0 && (
                  <tr>
                    <td style={{ padding: '16px 40px 0 40px' }}>
                      <p style={{ color: ORANGE, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '24px 0 12px 0' }}>
                        ★ New Reviews
                      </p>
                      {reviews.map((r) => (
                        <ItemRow key={r.slug} item={r} siteUrl={siteUrl} />
                      ))}
                    </td>
                  </tr>
                )}

                {/* Article section */}
                {articles.length > 0 && (
                  <tr>
                    <td style={{ padding: '16px 40px 0 40px' }}>
                      <p style={{ color: ORANGE, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '24px 0 12px 0' }}>
                        Articles
                      </p>
                      {articles.map((a) => (
                        <ItemRow key={a.slug} item={a} siteUrl={siteUrl} />
                      ))}
                    </td>
                  </tr>
                )}

                {/* CTA */}
                <tr>
                  <td style={{ padding: '32px 40px 24px 40px' }}>
                    <table cellPadding={0} cellSpacing={0}>
                      <tr>
                        <td style={{ backgroundColor: ORANGE, borderRadius: '8px' }}>
                          <a
                            href={siteUrl}
                            style={{ display: 'inline-block', padding: '14px 28px', color: TEXT, fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
                          >
                            Visit Boss Daddy →
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                {/* Footer */}
                <tr>
                  <td style={{ backgroundColor: '#0d0d0d', padding: '20px 40px', borderTop: `1px solid ${BORDER}` }}>
                    <p style={{ color: FAINT, fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
                      <a href={siteUrl} style={{ color: FAINT, textDecoration: 'none' }}>BossDaddyLife.com</a>
                      {' · '}
                      <a href={`${siteUrl}/affiliate-disclosure`} style={{ color: FAINT, textDecoration: 'none' }}>Disclosure</a>
                      {' · '}
                      <a href={`${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`} style={{ color: FAINT, textDecoration: 'none' }}>Unsubscribe</a>
                    </p>
                    <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
                      Sent to {email}
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

function ItemRow({ item, siteUrl }: { item: DigestItem; siteUrl: string }) {
  const url = `${siteUrl}/${item.type}s/${item.slug}`
  return (
    <table width='100%' cellPadding={0} cellSpacing={0} style={{ marginBottom: '12px' }}>
      <tr>
        <td style={{ padding: '14px', backgroundColor: '#0d0d0d', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
          <a href={url} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
            <p style={{ color: TEXT, fontWeight: 700, fontSize: '15px', margin: '0 0 6px 0', lineHeight: '1.3' }}>
              {item.title}
              {item.type === 'review' && item.rating != null && (
                <span style={{ color: ORANGE, fontWeight: 700, marginLeft: '8px' }}>· {item.rating}/10</span>
              )}
            </p>
            {item.excerpt && (
              <p style={{ color: MUTED, fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                {item.excerpt.length > 120 ? item.excerpt.slice(0, 120).trimEnd() + '…' : item.excerpt}
              </p>
            )}
            <p style={{ color: ORANGE, fontSize: '12px', fontWeight: 600, margin: '8px 0 0 0' }}>
              Read {item.type === 'review' ? 'review' : 'guide'} →
            </p>
          </a>
        </td>
      </tr>
    </table>
  )
}
