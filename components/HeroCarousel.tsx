'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'

interface Review {
  id: string
  slug: string
  title: string
  product_name: string
  rating: number
  image_url: string | null
}

const SWIPE_THRESHOLD = 50

export default function HeroCarousel({ reviews }: { reviews: Review[] }) {
  const [current, setCurrent] = useState(0)
  const paused   = useRef(false)
  const startX   = useRef(0)
  const startY   = useRef(0)
  const didSwipe = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused.current) setCurrent((c) => (c + 1) % reviews.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [reviews.length])

  function navigate(dir: 1 | -1) {
    paused.current = true
    setCurrent((c) => (c + dir + reviews.length) % reviews.length)
    setTimeout(() => { paused.current = false }, 4000)
  }

  // Touch swipe handlers (more reliable than pointer events on mobile)
  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    didSwipe.current = false
  }

  function onTouchEnd(e: React.TouchEvent) {
    const dx = startX.current - e.changedTouches[0].clientX
    const dy = startY.current - e.changedTouches[0].clientY
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      didSwipe.current = true
      navigate(dx > 0 ? 1 : -1)
    }
  }

  function onLinkClick(e: React.MouseEvent) {
    if (didSwipe.current) {
      e.preventDefault()
      didSwipe.current = false
    }
  }

  const r = reviews[current]

  return (
    <div
      className="w-full md:w-72 lg:w-80 shrink-0 select-none"
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Top Picks</p>

      {/* Card + arrow buttons */}
      <div className="relative group">
        <Link
          href={`/reviews/${r.slug}`}
          onClick={onLinkClick}
          className="block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
        >
          {r.image_url && (
            <div className="relative w-full h-44 bg-gray-800">
              <Image
                src={r.image_url}
                alt={r.product_name}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 768px) 100vw, 320px"
              />
              {r.rating >= 8 && (
                <div className="absolute top-3 right-3">
                  <BossApprovedBadge size="sm" variant="card" />
                </div>
              )}
            </div>
          )}
          <div className="p-5">
            <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest">
              {r.product_name}
            </span>
            <p className="text-sm font-semibold mt-1 leading-snug group-hover:text-orange-400 transition-colors">
              {r.title}
            </p>
            <div className="mt-2">
              <RatingScore rating={r.rating} />
            </div>
          </div>
        </Link>

        {/* Desktop arrow buttons — hidden on touch, revealed on hover */}
        <button
          onClick={e => { e.preventDefault(); navigate(-1) }}
          className="hidden md:flex absolute left-2 top-[88px] -translate-y-1/2 z-10
            w-8 h-8 items-center justify-center
            bg-black/60 hover:bg-black/80 text-white rounded-full
            opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="Previous"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={e => { e.preventDefault(); navigate(1) }}
          className="hidden md:flex absolute right-2 top-[88px] -translate-y-1/2 z-10
            w-8 h-8 items-center justify-center
            bg-black/60 hover:bg-black/80 text-white rounded-full
            opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          aria-label="Next"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-0 mt-3">
        {reviews.map((_, i) => (
          <button
            key={i}
            onClick={() => { paused.current = true; setCurrent(i); setTimeout(() => { paused.current = false }, 4000) }}
            className="p-3 flex items-center justify-center"
            aria-label={`Go to slide ${i + 1}`}
          >
            <span className={`rounded-full transition-all duration-200 block ${
              i === current
                ? 'w-4 h-1.5 bg-orange-500'
                : 'w-1.5 h-1.5 bg-gray-700 hover:bg-gray-500'
            }`} />
          </button>
        ))}
      </div>
    </div>
  )
}
