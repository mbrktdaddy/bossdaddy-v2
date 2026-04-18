'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import BossApprovedBadge from '@/components/BossApprovedBadge'

interface Review {
  id: string
  slug: string
  title: string
  product_name: string
  rating: number
  image_url: string | null
}

export default function HeroCarousel({ reviews }: { reviews: Review[] }) {
  const [current, setCurrent] = useState(0)
  const paused = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused.current) {
        setCurrent((c) => (c + 1) % reviews.length)
      }
    }, 3500)
    return () => clearInterval(interval)
  }, [reviews.length])

  const r = reviews[current]

  return (
    <div
      className="w-full md:w-72 lg:w-80 shrink-0"
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
    >
      <p className="text-xs text-orange-500 uppercase tracking-widest mb-3">Top Picks</p>
      <Link
        href={`/reviews/${r.slug}`}
        className="group block bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
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
            {r.rating === 5 && (
              <div className="absolute top-3 right-3">
                <BossApprovedBadge size="sm" />
              </div>
            )}
          </div>
        )}
        <div className="p-4">
          <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest">
            {r.product_name}
          </span>
          <p className="text-sm font-semibold mt-1 leading-snug group-hover:text-orange-400 transition-colors">
            {r.title}
          </p>
          <div className="flex items-center gap-0.5 mt-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <svg key={n} className={`w-3 h-3 ${n <= r.rating ? 'text-yellow-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
        </div>
      </Link>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {reviews.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className="p-2 flex items-center justify-center"
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
