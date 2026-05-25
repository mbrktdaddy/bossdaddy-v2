'use client'

import { useEffect, useState, startTransition } from 'react'
import { useRouter } from 'next/navigation'

const MAX_ATTEMPTS = 5
const POLL_MS = 3000
const STORAGE_KEY = 'bd_order_poll_attempts'

// Refreshes the server component after a short delay so the order
// appears once the Stripe webhook has written it to the DB.
// Gives up after MAX_ATTEMPTS refreshes to avoid an infinite loop when
// the webhook is delayed or fails.
export default function OrderPoller() {
  const router = useRouter()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const attempts = parseInt(sessionStorage.getItem(STORAGE_KEY) ?? '0', 10)
    if (attempts >= MAX_ATTEMPTS) {
      startTransition(() => setTimedOut(true))
      sessionStorage.removeItem(STORAGE_KEY)
      return
    }
    sessionStorage.setItem(STORAGE_KEY, String(attempts + 1))
    const id = setTimeout(() => router.refresh(), POLL_MS)
    return () => clearTimeout(id)
  }, [router])

  if (timedOut) {
    return (
      <p className="mt-4 text-sm text-prose-faint">
        Taking longer than expected.{' '}
        <a
          href="mailto:boss@bossdaddylife.com?subject=Order%20confirmation%20question"
          className="text-accent-text-soft hover:text-accent underline"
        >
          Email us
        </a>{' '}
        with your order reference and we&apos;ll sort it out.
      </p>
    )
  }

  return null
}
