import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/merch'
import OrderPoller from './_components/OrderPoller'
import CartClearer from './_components/CartClearer'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/Button'
import PageHeader from '@/components/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { BagIcon } from '@/components/icons'
import OrderLookupError from './_components/OrderLookupError'
import { FREE_SHIPPING_LABEL } from '../../shop/_lib/shipping'
import { LABELS } from '@/lib/labels'

export const metadata: Metadata = {
  title: 'Order Confirmed — Boss Daddy Life',
  robots: { index: false },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderPage({ params }: Props) {
  const { id: sessionId } = await params

  // Confirm payment with Stripe
  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return <OrderLookupError />
  }

  if (session.payment_status !== 'paid') redirect('/cart')

  // Try to load order — webhook may not have fired yet
  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select(`
      id, order_number, status, total_cents, subtotal_cents, tax_cents, email, shipping_address, created_at,
      order_items ( id, qty, unit_price_cents, name_snapshot, image_snapshot_url )
    `)
    .eq('stripe_session_id', sessionId)
    .maybeSingle()

  // Webhook hasn't fired yet — poll until it does
  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 sm:py-12">
        <PageHeader size="compact" eyebrow="Payment confirmed" title="Finalizing your order" />
        <Card tone="chrome" className="p-6 sm:p-8 mt-6">
          <OrderPoller />
        </Card>
      </div>
    )
  }

  type OrderItem = { id: string; qty: number; unit_price_cents: number; name_snapshot: string; image_snapshot_url: string | null }
  type ShippingAddress = { name?: string; line1?: string; line2?: string | null; city?: string; state?: string; postal_code?: string }
  const items = order.order_items as unknown as OrderItem[]
  const addr = order.shipping_address as ShippingAddress | null

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:py-12">
      <CartClearer />
      <PageHeader
        size="compact"
        back={{ href: '/shop', label: LABELS.shop.short }}
        eyebrow="Order confirmed"
        title={order.order_number}
        deck={`Confirmation sent to ${order.email ?? session.customer_details?.email ?? 'your email'}`}
        actions={<Badge tone="success">Paid</Badge>}
        className="mb-6"
      />

      {/* Line items */}
      <Card tone="chrome" className="overflow-hidden mb-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 border-b border-soft last:border-0">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-surface-sunken border-b-[3px] border-chrome shrink-0">
              {item.image_snapshot_url ? (
                <Image src={item.image_snapshot_url} alt={item.name_snapshot} fill className="object-cover" sizes="64px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BagIcon className="w-6 h-6 text-prose-faint" strokeWidth={1} aria-hidden />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-prose leading-snug">{item.name_snapshot}</p>
              <p className="text-prose-faint text-sm mt-0.5">Qty {item.qty}</p>
            </div>
            <p className="text-prose font-bold text-sm shrink-0 tabular-nums">{formatPrice(item.unit_price_cents * item.qty)}</p>
          </div>
        ))}
      </Card>

      {/* Totals */}
      <Card tone="chrome" className="p-5 sm:p-6 mb-4 space-y-2 text-sm">
        <div className="flex justify-between text-prose-muted">
          <span>Subtotal</span>
          <span className="text-prose tabular-nums">{formatPrice(order.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between text-prose-muted">
          <span>Shipping</span>
          <span className="text-success-ink font-semibold">{FREE_SHIPPING_LABEL}</span>
        </div>
        {(order.tax_cents ?? 0) > 0 && (
          <div className="flex justify-between text-prose-muted">
            <span>Tax</span>
            <span className="text-prose tabular-nums">{formatPrice(order.tax_cents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-3 border-t border-soft">
          <span className="font-black text-prose">Total</span>
          <span className="font-black text-prose text-lg tabular-nums">{formatPrice(order.total_cents)}</span>
        </div>
      </Card>

      {/* Shipping address */}
      {addr && (
        <Card tone="chrome" className="p-5 sm:p-6 mb-8">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Ships to</p>
          <p className="text-prose font-semibold">{addr.name}</p>
          <p className="text-prose-muted text-sm">{addr.line1}</p>
          {addr.line2 && <p className="text-prose-muted text-sm">{addr.line2}</p>}
          <p className="text-prose-muted text-sm">
            {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}
          </p>
        </Card>
      )}

      <div className="text-center">
        <Link
          href="/shop"
          className={buttonVariants({ size: 'lg' })}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
