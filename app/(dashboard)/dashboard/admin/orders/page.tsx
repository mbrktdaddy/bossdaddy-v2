import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { formatPrice } from '@/lib/merch'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Orders — Admin' }

type OrderStatus = 'pending_payment' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'

const STATUS_STYLES: Record<OrderStatus, { label: string; cls: string }> = {
  pending_payment: { label: 'Pending',    cls: 'bg-surface-raised border-strong text-prose-muted' },
  paid:            { label: 'Paid',       cls: 'bg-amber-950/60 border-amber-700/40 text-amber-400' },
  processing:      { label: 'Processing', cls: 'bg-blue-950/40 border-blue-700/40 text-blue-300' },
  shipped:         { label: 'Shipped',    cls: 'bg-green-950/40 border-green-700/40 text-forest' },
  delivered:       { label: 'Delivered',  cls: 'bg-green-950/40 border-green-700/40 text-forest' },
  cancelled:       { label: 'Cancelled',  cls: 'bg-red-950/40 border-red-700/40 text-red-300' },
  refunded:        { label: 'Refunded',   cls: 'bg-accent-tint border-accent-border/50 text-accent-text-soft' },
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
        <p className="text-red-300 text-sm">Failed to load orders: {error.message}</p>
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
        <p className="text-prose-faint text-sm mt-1">
          {orders.length} order{orders.length !== 1 ? 's' : ''} total
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-surface border border-soft rounded-xl p-12 text-center">
          <p className="text-prose-muted text-lg font-semibold mb-2">No orders yet.</p>
          <p className="text-prose-faint text-sm">Orders will appear here after your first Stripe checkout.</p>
        </div>
      ) : (
        <div className="bg-surface border border-soft rounded-xl overflow-x-auto">
          <div className="min-w-[640px]">

          {/* Table header */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-3 border-b border-soft text-xs text-prose-faint uppercase tracking-widest font-semibold">
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
                className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-5 py-4 border-b border-soft last:border-0 items-center hover:bg-surface-raised/30 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-prose font-bold text-sm">{order.order_number}</p>
                    {!order.confirmation_email_sent_at && order.confirmation_email_attempts > 0 && (
                      <span
                        title={order.confirmation_email_error ?? 'No confirmation email sent'}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-950/40 text-red-300"
                      >
                        ✉ failed ({order.confirmation_email_attempts})
                      </span>
                    )}
                  </div>
                  <p className="text-prose-faint text-xs mt-0.5">{date}</p>
                </div>
                <p className="text-prose-muted text-sm truncate">{order.email}</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.cls}`}>
                  {badge.label}
                </span>
                <p className="text-accent-text-soft font-bold text-sm text-right">
                  {formatPrice(order.total_cents)}
                </p>
                <p className="text-prose-faint text-xs text-right font-mono">
                  {order.printful_order_id ?? '—'}
                </p>
              </div>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}
