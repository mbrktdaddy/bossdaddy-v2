'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'

const DEFAULT_VISIBLE = 5

interface TopItem {
  id: string
  title: string
  slug: string
  category: string
  view_count: number | null
  image_url: string | null
  type: 'article' | 'review'
  published_at: string | null
}

export function TopPerformers({ items }: { items: TopItem[] }) {
  const [expanded, setExpanded] = useState(false)

  if (!items.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
        <p className="text-sm text-gray-500">No published content with views yet. Publish something and check back!</p>
      </div>
    )
  }

  const totalViews = items.reduce((sum, i) => sum + (i.view_count ?? 0), 0)
  const max = Math.max(...items.map((i) => i.view_count ?? 0), 1)
  const visible = expanded ? items : items.slice(0, DEFAULT_VISIBLE)
  const hasMore = items.length > DEFAULT_VISIBLE

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {expanded ? `All ${items.length} published` : 'Top 5 by views'}
        </p>
        <p className="text-xs text-gray-600 font-mono">{totalViews.toLocaleString()} total</p>
      </div>
      <div className="divide-y divide-gray-800">
        {visible.map((item, i) => {
          const category = getCategoryBySlug(item.category)
          const percent = Math.round(((item.view_count ?? 0) / max) * 100)
          const href = item.type === 'article' ? `/dashboard/articles/${item.id}` : `/dashboard/reviews/${item.id}`
          return (
            <Link key={`${item.type}-${item.id}`} href={href} className="block px-5 py-3 hover:bg-gray-950/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-600 w-4 shrink-0">{i + 1}</span>

                {/* Thumbnail */}
                <div className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.title} fill className="object-cover" sizes="40px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${
                      item.type === 'article'
                        ? 'bg-blue-950/40 text-blue-400 border-blue-900/40'
                        : 'bg-orange-950/40 text-orange-400 border-orange-900/40'
                    }`}>
                      {item.type}
                    </span>
                    <p className="text-sm text-white truncate">{item.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden max-w-xs">
                      <div
                        className="h-full bg-orange-500 rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    {category && <span className={`text-xs ${category.accent}`}>{category.label}</span>}
                  </div>
                </div>
                <span className="text-sm font-mono font-bold text-white shrink-0">
                  {(item.view_count ?? 0).toLocaleString()}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-5 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-950/40 border-t border-gray-800 transition-colors text-center"
        >
          {expanded ? '↑ Show top 5 only' : `↓ Show all ${items.length} published`}
        </button>
      )}
    </div>
  )
}
