'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CART_UPDATED_EVENT } from '@/lib/cart-events'

export default function CartIcon() {
  const [count, setCount] = useState(0)
  const pathname = usePathname()

  const fetchCount = useCallback(() => {
    fetch('/api/cart')
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchCount()
  }, [pathname, fetchCount])

  useEffect(() => {
    window.addEventListener(CART_UPDATED_EVENT, fetchCount)
    return () => window.removeEventListener(CART_UPDATED_EVENT, fetchCount)
  }, [fetchCount])

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart (${count} item${count !== 1 ? 's' : ''})` : 'Cart'}
      className="relative p-2 rounded-lg text-prose-muted hover:text-white hover:bg-surface transition-colors"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
