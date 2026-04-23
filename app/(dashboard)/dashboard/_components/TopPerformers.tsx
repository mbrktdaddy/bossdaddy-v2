import Link from 'next/link'
import { getCategoryBySlug } from '@/lib/categories'

interface TopItem {
  id: string
  title: string
  slug: string
  category: string
  view_count: number | null
  type: 'article' | 'review'
  published_at: string | null
}

export function TopPerformers({ items }: { items: TopItem[] }) {
  if (!items.length) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
        <p className="text-sm text-gray-500">No published content with views yet. Publish something and check back!</p>
      </div>
    )
  }

  const totalViews = items.reduce((sum, i) => sum + (i.view_count ?? 0), 0)
  const max = Math.max(...items.map((i) => i.view_count ?? 0), 1)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
        <p className="text-sm font-semibold">Top 5 by views</p>
        <p className="text-xs text-gray-600 font-mono">{totalViews.toLocaleString()} total</p>
      </div>
      <div className="divide-y divide-gray-800">
        {items.map((item, i) => {
          const category = getCategoryBySlug(item.category)
          const percent = Math.round(((item.view_count ?? 0) / max) * 100)
          const href = item.type === 'article' ? `/dashboard/articles/${item.id}` : `/dashboard/reviews/${item.id}`
          return (
            <Link key={`${item.type}-${item.id}`} href={href} className="block px-5 py-3 hover:bg-gray-950/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-gray-600 w-4">{i + 1}</span>
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
    </div>
  )
}
