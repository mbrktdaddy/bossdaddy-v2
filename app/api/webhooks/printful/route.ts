import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Printful webhooks don't support request signing like Stripe.
// Secure the endpoint with a token in the URL query string:
//   Printful webhook URL → https://www.bossdaddylife.com/api/webhooks/printful?token=YOUR_SECRET
// Set PRINTFUL_WEBHOOK_SECRET in Vercel env vars to the same value.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const expectedToken = process.env.PRINTFUL_WEBHOOK_SECRET

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = body as {
    type: string
    data?: {
      shipment?: {
        tracking_number?: string
        tracking_url?: string
        carrier?: string
      }
      order?: {
        id?: number
      }
    }
  }

  if (event.type === 'package_shipped') {
    try {
      await handlePackageShipped(event.data)
    } catch (err) {
      console.error('[printful webhook] package_shipped error:', err)
      return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}

async function handlePackageShipped(data: {
  shipment?: { tracking_number?: string; tracking_url?: string; carrier?: string }
  order?: { id?: number }
} | undefined) {
  if (!data?.order?.id) throw new Error('No order ID in payload')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('orders')
    .update({
      status: 'shipped',
      tracking_number: data.shipment?.tracking_number ?? null,
      tracking_url:    data.shipment?.tracking_url    ?? null,
      carrier:         data.shipment?.carrier         ?? null,
    })
    .eq('printful_order_id', data.order.id)

  if (error) throw new Error(`DB update failed: ${error.message}`)
}
