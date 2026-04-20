'use client'
import { useState, useTransition } from 'react'
import ArticleCard from './ArticleCard'
import { loadMoreArticles } from '../actions'
import type { ArticleRow } from '../actions'

interface Props {
  initialItems: ArticleRow[]
  total: number
  category: string
}

export default function ArticlesGrid({ initialItems, total, category }: Props) {
  const [items, setItems]            = useState<ArticleRow[]>(initialItems)
  const [page, setPage]              = useState(2)
  const [isPending, startTransition] = useTransition()

  const hasMore = items.length < total

  function handleLoadMore() {
    startTransition(async () => {
      const next = await loadMoreArticles(category, page)
      setItems(prev => [...prev, ...next])
      setPage(p => p + 1)
    })
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((a, i) => <ArticleCard key={a.id} article={a} priority={i < 3} />)}
      </div>
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="px-8 py-3 bg-gray-900 border border-gray-700 rounded-xl text-sm font-semibold text-gray-300 hover:border-orange-600 hover:text-white transition-all disabled:opacity-50"
          >
            {isPending ? 'Loading...' : `Load more (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </>
  )
}
