'use client'

import { useRouter } from 'next/navigation'
import { RouteError } from '@/components/ui/RouteError'

// Stripe couldn't confirm the session (network blip, bad link). Say so — a
// silent redirect to /cart looks like the order vanished. "Try again" re-runs
// the server lookup; the parent is the shop.
export default function OrderLookupError() {
  const router = useRouter()
  return (
    <RouteError
      error={new Error('Order lookup failed: could not retrieve the Stripe checkout session')}
      reset={() => router.refresh()}
      title="We couldn't load your order"
      body="We couldn't confirm this order with our payment processor just now. If you were charged, you'll get a confirmation email. Try again in a moment."
      back={{ href: '/shop', label: 'Shop' }}
    />
  )
}
