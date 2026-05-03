'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Product } from '@/lib/products'

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

  const href = product.affiliate_url ? `/go/${product.slug}` : product.non_affiliate_url
  if (!href) return null

  const isAffiliate = Boolean(product.affiliate_url)
  const rel = isAffiliate ? 'sponsored nofollow noopener' : 'noopener'
  const show = scrolled && !otherCtaVisible

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-950/95 backdrop-blur-md border-t border-orange-900/40 shadow-2xl shadow-black/60 px-4 pt-3 transition-transform duration-300 ${show ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        {product.image_url && (
          <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-900">
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-contain p-1"
              sizes="48px"
            />
          </div>
        )}
        <p className="flex-1 min-w-0 text-sm font-bold text-white leading-tight line-clamp-2">
          {product.name}
        </p>
        <a
          href={href}
          target="_blank"
          rel={rel}
          data-product-slug={product.slug}
          className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center"
        >
          Check Price
        </a>
      </div>
    </div>
  )
}
