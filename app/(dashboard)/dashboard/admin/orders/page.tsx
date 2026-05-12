import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { formatPrice } from '@/lib/merch'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Orders — Admin' }

type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

const STATUS_STYLES: Record<OrderStatus, { label: string; cls: string }> = {
  pending_payment: { label: 'Pending',    cls: 'bg-gray-800 text-gray-400' },
  paid:            { label: 'Paid',       cls: 'bg-amber-950/60 text-amber-400' },
  processing:      { label: 'Processing', cls: 'bg-blue-950/60 text-blue-400' },
  shipped:         { label: 'Shipped',    cls: 'bg-green-950/60 text-green-400' },
  delivered:       { label: 'Delivered',  cls: 'bg-green-950/80 text-green-300' },
  cancelled:       { label: 'Cancelled',  cls: 'bg-red-950/60 text-red-400' },
  refunded:        { label: 'Refunded',   cls: 'bg-orange-950/60 text-orange-400' },
}

export default async function AdminOrdersPage() {
  await requireAdmin()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('orders')
    .select('id, order_number, status, email, total_cents, printful_order_id, stripe_session_id, created_at, confirmation_email_sent_at, confirmation_email_error, confirmation_email_attempts')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400 text-sm">Failed to load orders: {error.message}</p>
      </div>
    )
  }

  const orders = (data ?? []) as Array<{
    id: string
    order_number: string
    status: OrderStatus
    email: string
    total_cents: number
    printful_order_id: number | null
    stripe_session_id: string
    created_at: string
    confirmation_email_sent_at: string | null
    confirmation_email_error: string | null
    confirmation_email_attempts: number
  }>

  return (
    <div className="p-8 max-w-5xl">

      <div className="mb-8">
        <h1 className="text-2xl font-black">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          {orders.length} order{orders.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-gray-400 text-lg font-semibold mb-2">No orders yet.</p>
          <p className="text-gray-600 text-sm">Orders will appear here after your first Stripe checkout.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-widest font-semibold">
            <span>Order</span>
            <span>Customer</span>
            <span>Status</span>
            <span className="text-right">Total</span>
            <span className="text-right">Printful</span>
          </div>

          {orders.map((order) => {
            const badge = STATUS_STYLES[order.status] ?? STATUS_STYLES.pending_payment
            const date = new Date(order.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
            return (
              <div
                key={order.id}
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-4 border-b border-gray-800/60 last:border-0 items-center hover:bg-gray-800/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm">{order.order_number}</p>
                    {!order.confirmation_email_sent_at && order.confirmation_email_attempts > 0 && (
                      <span
                        title={order.confirmation_email_error ?? 'No confirmation email sent'}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950/60 text-red-400"
                      >
                        ✉ failed ({order.confirmation_email_attempts})
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 text-xs mt-0.5">{date}</p>
                </div>
                <p className="text-gray-400 text-sm truncate">{order.email}</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
                <p className="text-orange-400 font-bold text-sm text-right">
                  {formatPrice(order.total_cents)}
                </p>
                <p className="text-gray-600 text-xs text-right font-mono">
                  {order.printful_order_id ?? '—'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
