'use client'

import { useEffect } from 'react'
import { dispatchCartUpdated } from '@/lib/cart-events'

// Fires after the order detail renders so CartIcon re-fetches its badge count.
export default function CartClearer() {
  useEffect(() => {
    dispatchCartUpdated()
  }, [])
  return null
}
