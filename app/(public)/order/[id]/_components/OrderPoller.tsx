'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refreshes the server component after a short delay so the order
// appears once the Stripe webhook has written it to the DB.
export default function OrderPoller() {
  const router = useRouter()
  useEffect(() => {
    const id = setTimeout(() => router.refresh(), 3000)
    return () => clearTimeout(id)
  }, [router])
  return null
}
