import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrder } from '@/lib/printful'
import { checkRateLimit } from '@/lib/rate-limit'

// ─── Trust model ──────────────────────────────────────────────────────────────
// Printful's classic (v1) webhook API supports neither request signing nor
// custom headers, so we authenticate with a shared secret. Historically that
// secret rode in the URL query string (`?token=…`), which leaks into access
// logs / Sentry breadcrumbs / referrers and — combined with a body-trusting
// handler — let anyone who saw the URL forge a `package_shipped` event and
// overwrite ANY order's tracking (audit A3).
//
// Two defenses close that hole:
//   1. Accept the secret from the `x-printful-token` HEADER (preferred) as well
//      as the query string (back-compat), compared in constant time. Register
//      the webhook to send the header where possible so the secret stays out of
//      logs; rotate PRINTFUL_WEBHOOK_SECRET on any suspected exposure.
//   2. NEVER trust the webhook body for data. On `package_shipped` we re-fetch
//      the order from Printful with our server API key and write only the
//      authoritative tracking Printful reports. A leaked token can then at most
//      trigger a harmless re-sync of a real order we own — it cannot inject
//      fake tracking or flip an unrelated order.
// When Printful's v2 signed webhooks stabilize, switch (1) to HMAC verification.

function secretsMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on length mismatch — guard first (length is not secret).
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  const expectedToken = process.env.PRINTFUL_WEBHOOK_SECRET
  const providedToken =
    request.headers.get('x-printful-token') ??
    new URL(request.url).searchParams.get('token')

  if (!expectedToken || !secretsMatch(providedToken, expectedToken)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Flood backstop keyed by source IP — a valid-token holder still can't hammer
  // the endpoint (URL-token probing, retry storms). Fails open if Upstash is
  // absent (dev); no AI budget is at stake here.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const { success } = await checkRateLimit(`printful:${ip}`, 'printful-webhook')
  if (!success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = body as { type?: string; data?: { order?: { id?: number } } }

  if (event.type === 'package_shipped') {
    try {
      await handlePackageShipped(event.data?.order?.id)
    } catch (err) {
      console.error('[printful webhook] package_shipped error:', err)
      Sentry.captureException(err, { tags: { path: 'printful-webhook' } })
      // Generic body — never echo internals to a public endpoint (audit A6).
      return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}

async function handlePackageShipped(printfulOrderId: number | undefined) {
  if (!printfulOrderId) throw new Error('No order ID in payload')

  const admin = createAdminClient()

  // Only act on orders we actually own. This both prevents spending our Printful
  // API quota on forged/unknown IDs and scopes the (re-fetched) write.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ownOrder, error: lookupError } = await (admin as any)
    .from('orders')
    .select('id')
    .eq('printful_order_id', printfulOrderId)
    .maybeSingle()

  if (lookupError) throw new Error(`Order lookup failed: ${lookupError.message}`)
  if (!ownOrder) {
    // Not our order (or already reconciled elsewhere) — ignore silently.
    return
  }

  // Authoritative source of truth: re-fetch from Printful with our API key.
  // The webhook body is treated as an untrusted nudge to sync, nothing more.
  const order = await getOrder(printfulOrderId)
  const shipment = order.shipments?.[order.shipments.length - 1]

  if (!shipment) {
    // Printful signalled a shipment but exposes none yet (or the event was
    // forged for a real-but-unshipped order). Don't fabricate tracking — record
    // and bail; a genuine event will re-fire once the shipment materializes.
    Sentry.captureMessage(
      `[printful webhook] package_shipped for order ${printfulOrderId} but Printful reports no shipment`,
      'warning',
    )
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('orders')
    .update({
      status: 'shipped',
      tracking_number: shipment.tracking_number || null,
      tracking_url:    shipment.tracking_url    || null,
      carrier:         shipment.carrier         || null,
    })
    .eq('printful_order_id', printfulOrderId)

  if (error) throw new Error(`DB update failed: ${error.message}`)
}
