'use client'
import { useState, useTransition } from 'react'
import ReviewCard from './ReviewCard'
import { loadMoreReviews } from '../actions'
import type { ReviewRow } from '../actions'

interface Props {
  initialItems: ReviewRow[]
  total: number
  category: string
}

export default function ReviewsGrid({ initialItems, total, category }: Props) {
  const [items, setItems]              = useState<ReviewRow[]>(initialItems)
  const [page, setPage]                = useState(2)
  const [isPending, startTransition]   = useTransition()

  const hasMore = items.length < total

  function handleLoadMore() {
    startTransition(async () => {
      const next = await loadMoreReviews(category, page)
      setItems(prev => [...prev, ...next])
      setPage(p => p + 1)
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map(r => <ReviewCard key={r.id} review={r} />)}
      </div>
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="px-8 py-3 bg-gray-900 rounded-2xl shadow-lg shadow-black/30 text-sm font-semibold text-gray-300 hover:shadow-xl hover:shadow-black/50 hover:text-white transition-all disabled:opacity-50"
          >
            {isPending ? 'Loading...' : `Load more (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </>
  )
}
