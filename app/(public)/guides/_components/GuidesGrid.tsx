'use client'
import { useState, useTransition } from 'react'
import GuideCard from './GuideCard'
import { loadMoreGuides } from '../actions'
import type { GuideRow } from '../actions'

interface Props {
  initialItems: GuideRow[]
  total: number
  category: string
}

export default function GuidesGrid({ initialItems, total, category }: Props) {
  const [items, setItems]            = useState<GuideRow[]>(initialItems)
  const [page, setPage]              = useState(2)
  const [isPending, startTransition] = useTransition()

  const hasMore = items.length < total

  function handleLoadMore() {
    startTransition(async () => {
      const next = await loadMoreGuides(category, page)
      setItems(prev => [...prev, ...next])
      setPage(p => p + 1)
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((a, i) => <GuideCard key={a.id} guide={a} priority={i < 3} />)}
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
