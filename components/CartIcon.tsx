'use client'

// The header cart. It RESERVES ITS SLOT on md+ — always rendered, badge only
// when there's something in it. The count arrives from a client fetch after
// hydration, and when the icon itself only appeared with the first item the
// whole cluster (Tools, bell, account) slid left by a button-width the moment
// it landed. Now only the badge appears, which takes no space.
//
// PHONES KEEP SHOW/HIDE (`max-md:hidden` at zero): the masthead's right cluster
// there is bell + search + menu = 132px beside a ~165px logo lockup, so a
// permanent fourth 44px slot has no room at 360–393px (the Galaxy widths).
// A phone only pays for the cart once there's something in it, which is the old
// "secondary commerce" rule, kept where space forces it.
//
// It is a LINK (middle-click, prefetch, "open in new tab"), not a button that
// calls router.push — so it can't be <IconButton>, which only renders a
// <button>. It wears IconButton's exact recipe instead; keep the two in step.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CART_UPDATED_EVENT } from '@/lib/cart-events'
import { CountBadge } from '@/components/ui/CountBadge'
import { iconButtonClass } from '@/components/ui/IconButton'
import { BagIcon } from '@/components/icons'

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
      aria-label={count > 0 ? `Cart, ${count} item${count !== 1 ? 's' : ''}` : 'Cart'}
      className={iconButtonClass({ className: count > 0 ? '' : 'max-md:hidden' })}
    >
      <BagIcon className="w-5 h-5" strokeWidth={2} />
      <CountBadge count={count} className="absolute -top-0.5 -right-0.5" />
    </Link>
  )
}
