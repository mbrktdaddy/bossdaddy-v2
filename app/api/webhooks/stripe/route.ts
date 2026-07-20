import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrder, deleteOrder } from '@/lib/printful'
import { sendOrderConfirmationEmail } from '@/lib/order-emails'
import { createNotification } from '@/lib/notifications'

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    try {
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session)
    } catch (err) {
      console.error('[stripe webhook] checkout.session.completed error:', err)
      Sentry.captureException(err)
      // Return the actual error message so it's visible in Stripe's webhook
      // delivery log. Stripe still retries on any non-2xx, so this doesn't
      // change behavior — it just makes debugging possible. Stack stays in
      // Sentry/server logs — never leaked in the HTTP response body.
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json(
        { error: 'Order creation failed', message },
        { status: 500 },
      )
    }
  } else if (event.type === 'charge.refunded') {
    try {
      await handleChargeRefunded(event.data.object as Stripe.Charge)
    } catch (err) {
      console.error('[stripe webhook] charge.refunded error:', err)
      Sentry.captureException(err)
      const message = err instanceof Error ? err.message : String(err)
      return NextResponse.json({ error: 'Refund handling failed', message }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}

// A refund must also cancel the Printful order — otherwise a refunded customer
// still gets the product manufactured and shipped (orders auto-confirm on
// creation). Stripe fires charge.refunded for both full and partial refunds.
async function handleChargeRefunded(charge: Stripe.Charge) {
  // Only a full refund cancels fulfillment. A partial refund (e.g. a goodwill
  // discount) shouldn't pull the whole order from Printful.
  if (charge.amount_refunded < charge.amount) {
    console.log(`[stripe webhook] partial refund on ${charge.id} — order left in place`)
    return
  }

  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null
  if (!paymentIntentId) throw new Error('No payment_intent on refunded charge')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order } = await (admin as any)
    .from('orders')
    .select('id, status, printful_order_id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()

  if (!order) {
    console.warn(`[stripe webhook] refund for unknown payment_intent ${paymentIntentId}`)
    return
  }
  // Idempotent: a re-delivered refund event finds the status already terminal.
  if (order.status === 'refunded' || order.status === 'cancelled') return

  // Best-effort cancel: if Printful already started production it returns an
  // error (can't cancel) — log it, but still mark the order refunded since the
  // money has been returned regardless.
  if (order.printful_order_id) {
    try {
      await deleteOrder(order.printful_order_id)
    } catch (err) {
      console.error(
        `[stripe webhook] Printful cancel failed for order ${order.id} (printful ${order.printful_order_id}):`,
        err,
      )
      Sentry.captureException(err, { tags: { path: 'stripe.refund.printful-cancel' }, extra: { orderId: order.id } })
    }
  }

  await admin.from('orders').update({ status: 'refunded' }).eq('id', order.id)
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const admin = createAdminClient()

  const cartId = session.metadata?.cart_id
  if (!cartId) throw new Error('No cart_id in session metadata')

  // Idempotency guard: Stripe retries webhook deliveries (e.g., if a previous
  // call returned non-2xx, or for at-least-once delivery semantics). Without
  // this check, every retry would attempt to insert a duplicate order, hit the
  // unique(stripe_session_id) constraint, return 500, and trigger more retries.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingOrder } = await (admin as any)
    .from('orders')
    .select('id')
    .eq('stripe_session_id', session.id)
    .maybeSingle()

  if (existingOrder) {
    console.log(`[stripe webhook] duplicate delivery for ${session.id} — order ${existingOrder.id} already exists`)
    // Defensive cart cleanup: if a prior webhook invocation errored mid-flow
    // before reaching the cart delete, the cart still contains the purchased
    // items. Always sweep on duplicate delivery so retries finish the job.
    await admin.from('carts').delete().eq('id', cartId)
    return
  }

  // Fetch cart items with variant details needed for Printful
  const { data: cartItems } = await admin
    .from('cart_items')
    .select(`
      id, qty,
      merch:merch_id ( id, name, image_url, default_image_url ),
      variant:variant_id ( id, retail_price_cents, printful_sync_variant_id, size, color, image_url )
    `)
    .eq('cart_id', cartId)

  if (!cartItems || cartItems.length === 0) throw new Error('Cart empty or not found')

  // Look up user ownership of the cart
  const { data: cartRow } = await admin
    .from('carts').select('user_id').eq('id', cartId).maybeSingle()

  // Build shipping address from Stripe session.
  // Stripe API 2026-04-22.dahlia moved shipping_details from session root to
  // session.collected_information.shipping_details. Check the new path first,
  // fall back to the legacy path for any older sessions still in retry queues.
  type ShippingDetailsLike = {
    name?: string | null
    address?: {
      line1?: string | null
      line2?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
      country?: string | null
    } | null
  }
  const sessionExt = session as unknown as {
    collected_information?: { shipping_details?: ShippingDetailsLike | null } | null
    shipping_details?: ShippingDetailsLike | null
  }
  const sd: ShippingDetailsLike | null | undefined =
    sessionExt.collected_information?.shipping_details ?? sessionExt.shipping_details

  const shippingAddress = sd ? {
    name: sd.name ?? null,
    line1: sd.address?.line1 ?? null,
    line2: sd.address?.line2 ?? null,
    city: sd.address?.city ?? null,
    state: sd.address?.state ?? null,
    postal_code: sd.address?.postal_code ?? null,
    country: sd.address?.country ?? null,
  } : {}

  const subtotalCents = cartItems.reduce(
    (s, i) => s + i.qty * (i.variant as { retail_price_cents: number }).retail_price_cents,
    0,
  )

  // Insert order (orders table added post-type-gen — cast to bypass stale types)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: order, error: orderErr } = await (admin as any)
    .from('orders')
    .insert({
      user_id: cartRow?.user_id ?? null,
      email: session.customer_details?.email ?? '',
      status: 'paid',
      stripe_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      subtotal_cents: subtotalCents,
      shipping_cents: 0,
      tax_cents: session.total_details?.amount_tax ?? 0,
      total_cents: session.amount_total ?? subtotalCents,
      currency: session.currency ?? 'usd',
      shipping_address: shippingAddress,
    })
    .select('id, order_number')
    .single()

  if (orderErr || !order) throw new Error(`Insert order failed: ${orderErr?.message}`)

  // In-app notification for logged-in buyers (guest checkouts have no user_id).
  if (cartRow?.user_id) {
    await createNotification({
      userId: cartRow.user_id,
      type:   'order_complete',
      title:  'Order confirmed',
      body:   `Order #${order.order_number} is confirmed — we'll email tracking when it ships.`,
      link:   `/order/${order.id}`,
      payload: { order_id: order.id, order_number: order.order_number },
    })
  }

  // Insert order_items with snapshot of product name/image at purchase time
  const orderItemRows = cartItems.map((item) => {
    const merch = item.merch as { id: string; name: string; image_url: string | null; default_image_url: string | null }
    const variant = item.variant as { id: string; retail_price_cents: number; image_url: string | null }
    return {
      order_id: order.id,
      merch_id: merch.id,
      variant_id: variant.id,
      qty: item.qty,
      unit_price_cents: variant.retail_price_cents,
      name_snapshot: merch.name,
      image_snapshot_url: variant.image_url ?? merch.image_url ?? merch.default_image_url ?? null,
    }
  })

  await admin.from('order_items').insert(orderItemRows)

  // Create Printful order for items that have a sync variant ID
  const printfulItems = cartItems
    .map((i) => ({ i, v: i.variant as { retail_price_cents: number; printful_sync_variant_id: number | null } }))
    .filter(({ v }) => v.printful_sync_variant_id != null)

  if (printfulItems.length > 0 && sd?.address?.line1 && session.customer_details?.email) {
    try {
      const printfulOrder = await createOrder(
        {
          // Printful caps external_id at 32 chars — a Stripe session id
          // (cs_live_…, ~66 chars) is rejected with "Invalid External ID
          // specified". Use our order number (e.g. BD-2026-0009): short,
          // unique, and meaningful for reconciliation.
          external_id: order.order_number,
          shipping: 'STANDARD',
          recipient: {
            name: sd.name ?? '',
            address1: sd.address.line1,
            city: sd.address?.city ?? '',
            state_code: sd.address?.state ?? '',
            country_code: sd.address?.country ?? 'US',
            zip: sd.address?.postal_code ?? '',
            email: session.customer_details.email,
          },
          items: printfulItems.map(({ i, v }) => ({
            sync_variant_id: v.printful_sync_variant_id!,
            quantity: i.qty,
            retail_price: (v.retail_price_cents / 100).toFixed(2),
          })),
        },
        true, // auto-confirm order
      )

      await admin
        .from('orders')
        .update({ printful_order_id: printfulOrder.id, status: 'processing' })
        .eq('id', order.id)
    } catch (err) {
      // Log and continue — order is in DB, Printful can be retried from admin panel
      console.error('[stripe webhook] Printful order failed:', err)
      Sentry.captureException(err, { tags: { path: 'stripe.checkout.printful-create' }, extra: { orderId: order.id } })
    }
  }

  // Send order confirmation email + persist the outcome so failures are visible
  // in admin and retryable by the nightly cron.
  const customerEmail = session.customer_details?.email
  if (customerEmail) {
    const result = await sendOrderConfirmationEmail({
      to: customerEmail,
      orderNumber: order.order_number,
      items: orderItemRows.map((r) => ({
        name: r.name_snapshot,
        qty: r.qty,
        unit_price_cents: r.unit_price_cents,
        image_snapshot_url: r.image_snapshot_url,
      })),
      subtotalCents,
      taxCents: session.total_details?.amount_tax ?? 0,
      totalCents: session.amount_total ?? subtotalCents,
      shippingAddress,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('orders').update({
      confirmation_email_sent_at: result.ok ? new Date().toISOString() : null,
      confirmation_email_error:   result.ok ? null : result.error,
      confirmation_email_attempts: 1,
    }).eq('id', order.id)
  }

  // Clear cart so it doesn't persist after purchase
  await admin.from('carts').delete().eq('id', cartId)
}
