import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPrice } from '@/lib/merch'
import OrderPoller from './_components/OrderPoller'
import CartClearer from './_components/CartClearer'
import type { Metadata } from 'next'

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
    redirect('/cart')
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
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="bg-gray-900 rounded-2xl p-10">
          <div className="w-16 h-16 rounded-full bg-green-900/40 flex items-center justify-center mx-auto mb-6 text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Payment confirmed!</h1>
          <p className="text-gray-400 mb-2">Finalizing your order — usually just a few seconds.</p>
          <p className="text-gray-600 text-sm">This page will refresh automatically.</p>
          <OrderPoller />
        </div>
      </div>
    )
  }

  type OrderItem = { id: string; qty: number; unit_price_cents: number; name_snapshot: string; image_snapshot_url: string | null }
  type ShippingAddress = { name?: string; line1?: string; line2?: string | null; city?: string; state?: string; postal_code?: string }
  const items = order.order_items as unknown as OrderItem[]
  const addr = order.shipping_address as ShippingAddress | null

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <CartClearer />

      {/* Header */}
      <div className="mb-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-900/40 flex items-center justify-center mx-auto mb-4 text-3xl">
          ✓
        </div>
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-2">— Order Confirmed</p>
        <h1 className="text-3xl font-black text-white mb-2">{order.order_number}</h1>
        <p className="text-gray-500 text-sm">
          Confirmation sent to{' '}
          <span className="text-gray-300">{order.email ?? session.customer_details?.email}</span>
        </p>
      </div>

      {/* Line items */}
      <div className="bg-gray-900 rounded-2xl overflow-hidden mb-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 border-b border-gray-800 last:border-0">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-800 shrink-0">
              {item.image_snapshot_url ? (
                <Image src={item.image_snapshot_url} alt={item.name_snapshot} fill className="object-cover" sizes="64px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl opacity-20">📦</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white leading-snug">{item.name_snapshot}</p>
              <p className="text-gray-500 text-sm mt-0.5">Qty {item.qty}</p>
            </div>
            <p className="text-orange-400 font-bold text-sm shrink-0">{formatPrice(item.unit_price_cents * item.qty)}</p>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-gray-900/60 rounded-2xl p-6 mb-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-400">
          <span>Subtotal</span>
          <span className="text-white">{formatPrice(order.subtotal_cents)}</span>
        </div>
        <div className="flex justify-between text-gray-400">
          <span>Shipping</span>
          <span className="text-green-400">Free</span>
        </div>
        {(order.tax_cents ?? 0) > 0 && (
          <div className="flex justify-between text-gray-400">
            <span>Tax</span>
            <span className="text-white">{formatPrice(order.tax_cents)}</span>
          </div>
        )}
        <div className="flex justify-between pt-3 border-t border-gray-800">
          <span className="font-black text-white">Total</span>
          <span className="font-black text-orange-400 text-lg">{formatPrice(order.total_cents)}</span>
        </div>
      </div>

      {/* Shipping address */}
      {addr && (
        <div className="bg-gray-900/60 rounded-2xl p-6 mb-10">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-3">Ships to</p>
          <p className="text-white font-semibold">{addr.name}</p>
          <p className="text-gray-400 text-sm">{addr.line1}</p>
          {addr.line2 && <p className="text-gray-400 text-sm">{addr.line2}</p>}
          <p className="text-gray-400 text-sm">
            {[addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')}
          </p>
        </div>
      )}

      <div className="text-center">
        <Link
          href="/gear"
          className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-xl transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  )
}
