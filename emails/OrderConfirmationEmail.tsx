import * as React from 'react'
import { EmailLayout, EmailButton, footerText, footerLink, DEFAULT_SITE_URL } from './_components/EmailLayout'

interface OrderItem {
  name: string
  qty: number
  unit_price_cents: number
  image_snapshot_url: string | null
}

interface ShippingAddress {
  name?: string | null
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

interface Props {
  orderNumber: string
  email: string
  items: OrderItem[]
  subtotalCents: number
  taxCents: number
  totalCents: number
  shippingAddress: ShippingAddress | null
  siteUrl?: string
}

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`
}

export function OrderConfirmationEmail({
  orderNumber,
  email,
  items,
  subtotalCents,
  taxCents,
  totalCents,
  shippingAddress,
  siteUrl = DEFAULT_SITE_URL,
}: Props) {
  return (
    <EmailLayout
      siteUrl={siteUrl}
      footer={
        <>
          <p style={{ ...footerText, margin: '0 0 8px 0' }}>
            Questions? Reply to this email or visit{' '}
            <a href={siteUrl} style={footerLink}>BossDaddyLife.com</a>
          </p>
          <p style={{ color: '#374151', fontSize: '11px', margin: 0 }}>Sent to {email}</p>
        </>
      }
    >
      <h1 style={{ color: '#ffffff', fontSize: '26px', fontWeight: 900, margin: '0 0 4px 0', lineHeight: '1.2' }}>
        Order Confirmed
      </h1>
      <p style={{ color: '#CC5500', fontSize: '14px', fontWeight: 700, margin: '0 0 24px 0', letterSpacing: '0.05em' }}>
        {orderNumber}
      </p>
      <p style={{ color: '#9ca3af', fontSize: '15px', lineHeight: '1.6', margin: '0 0 32px 0' }}>
        Your order is in — we&apos;re getting it to the printer. You&apos;ll get another email when it ships with tracking info.
      </p>

      {/* Line items */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '24px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #1f1f1f' }}>
        {items.map((item, i) => (
          <tr key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid #1f1f1f' : 'none' }}>
            <td style={{ padding: '14px 16px', verticalAlign: 'middle', width: '56px' }}>
              {item.image_snapshot_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_snapshot_url}
                  alt={item.name}
                  width={48}
                  height={48}
                  style={{ display: 'block', borderRadius: '6px', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: 48, height: 48, backgroundColor: '#1f1f1f', borderRadius: '6px' }} />
              )}
            </td>
            <td style={{ padding: '14px 16px', verticalAlign: 'middle' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '14px', fontWeight: 600 }}>{item.name}</p>
              <p style={{ margin: '2px 0 0', color: '#6b7280', fontSize: '12px' }}>Qty {item.qty}</p>
            </td>
            <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <p style={{ margin: 0, color: '#e87030', fontSize: '14px', fontWeight: 700 }}>
                {cents(item.unit_price_cents * item.qty)}
              </p>
            </td>
          </tr>
        ))}
      </table>

      {/* Totals */}
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: '28px' }}>
        <tr>
          <td style={{ padding: '4px 0', color: '#6b7280', fontSize: '13px' }}>Subtotal</td>
          <td style={{ padding: '4px 0', color: '#d1d5db', fontSize: '13px', textAlign: 'right' }}>{cents(subtotalCents)}</td>
        </tr>
        <tr>
          <td style={{ padding: '4px 0', color: '#6b7280', fontSize: '13px' }}>Shipping</td>
          <td style={{ padding: '4px 0', color: '#4ade80', fontSize: '13px', textAlign: 'right' }}>Free</td>
        </tr>
        {taxCents > 0 && (
          <tr>
            <td style={{ padding: '4px 0', color: '#6b7280', fontSize: '13px' }}>Tax</td>
            <td style={{ padding: '4px 0', color: '#d1d5db', fontSize: '13px', textAlign: 'right' }}>{cents(taxCents)}</td>
          </tr>
        )}
        <tr>
          <td style={{ padding: '12px 0 0', color: '#ffffff', fontSize: '15px', fontWeight: 900, borderTop: '1px solid #1f1f1f' }}>Total</td>
          <td style={{ padding: '12px 0 0', color: '#e87030', fontSize: '18px', fontWeight: 900, textAlign: 'right', borderTop: '1px solid #1f1f1f' }}>{cents(totalCents)}</td>
        </tr>
      </table>

      {/* Shipping address */}
      {shippingAddress?.name && (
        <div style={{ backgroundColor: '#0d0d0d', borderRadius: '8px', padding: '16px', marginBottom: '28px' }}>
          <p style={{ margin: '0 0 8px', color: '#6b7280', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ships to</p>
          <p style={{ margin: '0', color: '#d1d5db', fontSize: '13px', lineHeight: '1.6' }}>
            {shippingAddress.name}<br />
            {shippingAddress.line1}<br />
            {shippingAddress.line2 ? <>{shippingAddress.line2}<br /></> : null}
            {[shippingAddress.city, shippingAddress.state, shippingAddress.postal_code].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      <EmailButton href={`${siteUrl}/gear`}>Keep Shopping →</EmailButton>
    </EmailLayout>
  )
}
