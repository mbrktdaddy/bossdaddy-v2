import * as React from 'react'
import { LABELS } from '@/lib/labels'
import { BRAND } from '@/lib/brand'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

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
const BORDER = '#1f1f1f'
const TEXT   = '#ffffff'
const MUTED  = '#9ca3af'
const FAINT  = '#6b7280'

export function WeeklyDigestEmail({ email, items, weekLabel, siteUrl = DEFAULT_SITE_URL }: Props) {
  const reviews = items.filter((i) => i.type === 'review')
  const guides  = items.filter((i) => i.type === 'guide')

  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={footerText}>
            <a href={siteUrl} style={footerLink}>BossDaddyLife.com</a>
            {' · '}
            <a href={`${siteUrl}/affiliate-disclosure`} style={footerLink}>Disclosure</a>
            {' · '}
            <a href={`${siteUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`} style={footerLink}>Unsubscribe</a>
          </p>
          <p style={{ color: '#374151', fontSize: '11px', margin: '8px 0 0 0' }}>
            Sent to {email}
          </p>
        </>
      }
    >
      {/* Intro */}
      <table width='100%' cellPadding={0} cellSpacing={0}>
        <tr>
          <td style={{ padding: '0 0 16px 0' }}>
            <p style={{ margin: '0 0 8px 0', color: FAINT, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
              {weekLabel}
            </p>
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
      </table>

      {/* Review section */}
      {reviews.length > 0 && (
        <table width='100%' cellPadding={0} cellSpacing={0}>
          <tr>
            <td style={{ padding: '16px 0 0 0' }}>
              <p style={{ color: ORANGE, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '24px 0 12px 0' }}>
                ★ New {LABELS.reviews.plural}
              </p>
              {reviews.map((r) => (
                <ItemRow key={r.slug} item={r} siteUrl={siteUrl} />
              ))}
            </td>
          </tr>
        </table>
      )}

      {/* Guides section */}
      {guides.length > 0 && (
        <table width='100%' cellPadding={0} cellSpacing={0}>
          <tr>
            <td style={{ padding: '16px 0 0 0' }}>
              <p style={{ color: ORANGE, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', margin: '24px 0 12px 0' }}>
                {LABELS.guides.plural}
              </p>
              {guides.map((a) => (
                <ItemRow key={a.slug} item={a} siteUrl={siteUrl} />
              ))}
            </td>
          </tr>
        </table>
      )}

      {/* CTA */}
      <table width='100%' cellPadding={0} cellSpacing={0}>
        <tr>
          <td style={{ padding: '32px 0 24px 0' }}>
            <EmailButton href={siteUrl} style={{ margin: 0 }}>Visit Boss Daddy →</EmailButton>
          </td>
        </tr>
      </table>

      {/* Sign-off */}
      <table width='100%' cellPadding={0} cellSpacing={0}>
        <tr>
          <td style={{ padding: '4px 0 0 0' }}>
            <p style={{ color: ORANGE, fontWeight: 800, fontSize: '15px', margin: '0 0 2px 0' }}>{BRAND.tagline}</p>
            <p style={{ color: FAINT, fontSize: '13px', margin: 0 }}>— The Boss</p>
          </td>
        </tr>
      </table>
    </EmailLayout>
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
