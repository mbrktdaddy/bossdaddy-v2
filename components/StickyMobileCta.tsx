'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/products'
import { buttonVariants } from '@/components/ui/Button'
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/components/MobileBottomNav'
import { useBottomNavHidden } from '@/components/useBottomNavHidden'

interface Props {
  product: Pick<Product, 'slug' | 'name' | 'affiliate_url' | 'non_affiliate_url' | 'image_url' | 'store' | 'custom_store_name'>
}

/**
 * Mobile-only sticky bottom CTA that pins the affiliate link to the bottom
 * of the viewport while reading. Hides when the in-page ProductCtaCard
 * (marked with data-product-cta) is visible to avoid duplication. Includes
 * iOS safe-area padding so it sits above the home indicator.
 */
export default function StickyMobileCta({ product }: Props) {
  const [scrolled, setScrolled] = useState(false)
  const [otherCtaVisible, setOtherCtaVisible] = useState(false)

  // Show after the user starts reading (past the hero / header area)
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 400)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Hide when an in-page product CTA card is on screen
  useEffect(() => {
    const targets = document.querySelectorAll('[data-product-cta]')
    if (targets.length === 0) return
    const visibility = new Map<Element, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visibility.set(e.target, e.isIntersecting)
        setOtherCtaVisible(Array.from(visibility.values()).some(Boolean))
      },
      { threshold: 0.25 },
    )
    targets.forEach((t) => observer.observe(t))
    return () => observer.disconnect()
  }, [])

  // While the tab strip is scrolled away, drop to the screen's bottom edge.
  // (Called before the early return below — hooks must run every render.)
  const navHidden = useBottomNavHidden()
  const href = product.affiliate_url ? `/go/${product.slug}` : product.non_affiliate_url
  if (!href) return null

  const isAffiliate = Boolean(product.affiliate_url)
  const rel = isAffiliate ? 'sponsored nofollow noopener' : 'noopener'
  const show = scrolled && !otherCtaVisible

  return (
    // Stacks ABOVE the bottom tab strip (z-30 under its z-40) rather than covering
    // it — both used to sit at bottom-0, so the buy bar hid the tabs. The extra
    // bottom padding clears the Ask button, which bulges ~1rem above the strip.
    // Hidden = slid down behind the strip AND faded, so no ghost shows through it.
    <div
      data-theme="dark" /* chrome ZONE — stays near-black on the light canvas (lib/canvas.ts) */
      className={`md:hidden fixed left-0 right-0 z-30 bg-chrome/95 backdrop-blur-md border-t border-soft px-4 pt-3 pb-5 transition-[transform,opacity,bottom] duration-300 ${show ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      style={navHidden
        ? { bottom: 0, paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }
        : { bottom: MOBILE_BOTTOM_NAV_OFFSET }}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        {product.image_url && (
          <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-surface-raised border border-strong">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-contain p-1"
              sizes="48px"
            />
          </div>
        )}
        <p className="flex-1 min-w-0 text-sm font-bold text-zinc-50 leading-tight line-clamp-2">
          {product.name}
        </p>
        <a
          href={href}
          target="_blank"
          rel={rel}
          data-product-slug={product.slug}
          className={buttonVariants({ className: 'shrink-0 active:bg-accent-hover' })}
        >
          Check Price
        </a>
      </div>
    </div>
  )
}
