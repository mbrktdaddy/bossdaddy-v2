'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  reviewId: string
}

interface Summary {
  avg:        number | null
  count:      number
  userRating: number | null
  authed:     boolean
}

const RATINGS   = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const THRESHOLD = 3

export default function RatingWidget({ reviewId }: Props) {
  const pathname = usePathname()
  const [data,       setData]       = useState<Summary | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [hovered,    setHovered]    = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/ratings?review_id=${reviewId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ avg: null, count: 0, userRating: null, authed: false }))
  }, [reviewId])

  async function submitRating(rating: number) {
    if (!data?.authed || submitting) return
    setSubmitting(true)
    const res = await fetch('/api/ratings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ review_id: reviewId, rating }),
    })
    if (res.status === 401) {
      setData(prev => prev ? { ...prev, authed: false } : null)
    } else if (res.ok) {
      const json = await res.json()
      setData(json)
    }
    setSubmitting(false)
  }

  // Don't render until the fetch resolves (avoids layout shift)
  if (!data) return null

  const activeRating = hovered ?? data.userRating

  return (
    <div className="py-3 border-t border-gray-800/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">

        <span className="text-xs text-gray-500 shrink-0 select-none">Rate this product:</span>

        {data.authed ? (
          <div
            className="flex items-center gap-1"
            onMouseLeave={() => setHovered(null)}
          >
            {RATINGS.map(r => {
              const filled  = activeRating !== null && r <= activeRating
              const isChosen = data.userRating === r
              return (
                <button
                  key={r}
                  disabled={submitting}
                  onClick={() => submitRating(r)}
                  onMouseEnter={() => setHovered(r)}
                  className={`w-7 h-7 text-xs font-bold rounded-md border transition-all disabled:opacity-50
                    ${filled
                      ? 'bg-orange-600 border-orange-600 text-white'
                      : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-orange-600 hover:text-orange-400'
                    }
                    ${isChosen ? 'ring-1 ring-orange-300 ring-offset-1 ring-offset-black' : ''}
                  `}
                >
                  {r}
                </button>
              )
            })}
          </div>
        ) : (
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="text-xs text-orange-500 hover:text-orange-400 transition-colors"
          >
            Sign in to rate
          </Link>
        )}

        {data.count >= THRESHOLD && (
          <span className="text-xs text-gray-600">
            · Reader avg:{' '}
            <span className="text-gray-300 font-medium">{data.avg}/10</span>
            {' '}
            <span className="text-gray-700">
              ({data.count} {data.count === 1 ? 'rating' : 'ratings'})
            </span>
          </span>
        )}

      </div>
    </div>
  )
}
