import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendOrderConfirmationEmail } from '@/lib/order-emails'

export const maxDuration = 60

// GET /api/cron/retry-order-emails
// Runs nightly. Retries order confirmation emails that have not yet sent —
// transient Resend hiccups, rate limits, and brief sender-verification gaps
// all heal on retry. Caps at 5 attempts per order and 7 days of age so we
// don't spam a permanently-broken address forever.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — cron endpoint refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  const isVercelCron = authHeader === `Bearer ${secret}`
  const isManual     = qSecret === secret
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const ageCutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orders, error } = await (admin as any)
    .from('orders')
    .select(`
      id, order_number, email, subtotal_cents, tax_cents, total_cents, shipping_address,
      confirmation_email_attempts,
      order_items ( qty, unit_price_cents, name_snapshot, image_snapshot_url )
    `)
    .is('confirmation_email_sent_at', null)
    .lt('confirmation_email_attempts', 5)
    .gt('created_at', ageCutoff)
    .order('created_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('retry-order-emails: select failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    return NextResponse.json({ retried: 0, sent: 0, failed: 0 })
  }

  let sent = 0
  let failed = 0

  for (const order of orders as Array<{
    id: string
    order_number: string
    email: string
    subtotal_cents: number
    tax_cents: number
    total_cents: number
    shipping_address: unknown
    confirmation_email_attempts: number
    order_items: Array<{ qty: number; unit_price_cents: number; name_snapshot: string; image_snapshot_url: string | null }>
  }>) {
    if (!order.email) {
      failed++
      continue
    }

    const result = await sendOrderConfirmationEmail({
      to: order.email,
      orderNumber: order.order_number,
      items: order.order_items.map((r) => ({
        name: r.name_snapshot,
        qty: r.qty,
        unit_price_cents: r.unit_price_cents,
        image_snapshot_url: r.image_snapshot_url,
      })),
      subtotalCents: order.subtotal_cents,
      taxCents: order.tax_cents,
      totalCents: order.total_cents,
      shippingAddress: order.shipping_address as Parameters<typeof sendOrderConfirmationEmail>[0]['shippingAddress'],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('orders').update({
      confirmation_email_sent_at: result.ok ? new Date().toISOString() : null,
      confirmation_email_error:   result.ok ? null : result.error,
      confirmation_email_attempts: order.confirmation_email_attempts + 1,
    }).eq('id', order.id)

    if (result.ok) sent++
    else failed++
  }

  return NextResponse.json({ retried: orders.length, sent, failed })
}
