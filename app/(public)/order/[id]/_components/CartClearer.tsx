'use client'

import { useEffect } from 'react'

// Fires 'cart-updated' so CartIcon re-fetches after a successful order.
export default function CartClearer() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart-updated'))
  }, [])
  return null
}
