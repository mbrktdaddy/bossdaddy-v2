import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { createOrder } from '@/lib/printful'
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
      // Return the actual error message so it's visible in Stripe's webhook
      // delivery log. Stripe still retries on any non-2xx, so this doesn't
      // change behavior — it just makes debugging possible.
      const message = err instanceof Error ? err.message : String(err)
      const stack   = err instanceof Error ? err.stack : undefined
      return NextResponse.json(
        { error: 'Order creation failed', message, stack },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ received: true })
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
          external_id: session.id,
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
