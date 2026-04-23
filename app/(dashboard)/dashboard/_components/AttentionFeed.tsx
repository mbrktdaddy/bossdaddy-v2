import Link from 'next/link'
import { getCategoryBySlug } from '@/lib/categories'

type PendingItem = {
  id: string
  title: string
  category: string
  moderation_score: number | null
  moderation_flags: string[] | null
  created_at: string
  type: 'article' | 'review'
}

type PendingComment = {
  id: string
  body: string
  created_at: string
  profiles?: { username: string } | null
}

interface Props {
  pendingItems: PendingItem[]
  pendingComments: PendingComment[]
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AttentionFeed({ pendingItems, pendingComments }: Props) {
  const hasItems = pendingItems.length > 0 || pendingComments.length > 0

  if (!hasItems) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="text-gray-400 font-semibold">All clear.</p>
        <p className="text-gray-600 text-sm mt-1">Nothing needs your attention right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pendingItems.map((item) => {
        const score = item.moderation_score
        const category = getCategoryBySlug(item.category)
        const isHighRisk = score !== null && score >= 0.7
        const href = item.type === 'article'
          ? `/dashboard/articles/${item.id}`
          : `/dashboard/reviews/${item.id}`

        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={href}
            className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    item.type === 'article'
                      ? 'bg-blue-950/40 text-blue-400 border-blue-900/40'
                      : 'bg-orange-950/40 text-orange-400 border-orange-900/40'
                  }`}>
                    {item.type === 'article' ? 'Article' : 'Review'}
                  </span>
                  {category && <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>}
                  <span className="text-xs text-gray-600">{timeAgo(item.created_at)}</span>
                </div>
                <p className="text-sm font-semibold truncate">{item.title}</p>
                {item.moderation_flags && item.moderation_flags.length > 0 && (
                  <p className="text-xs text-red-400/80 mt-1 truncate">
                    ⚑ {item.moderation_flags.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {score === null ? (
                  <span className="text-xs text-gray-600 font-mono">—</span>
                ) : (
                  <span className={`text-sm font-mono font-bold ${
                    isHighRisk ? 'text-red-400' : score >= 0.4 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {score.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )
      })}

      {pendingComments.length > 0 && (
        <Link
          href="/dashboard/comments"
          className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-4 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {pendingComments.length} pending comment{pendingComments.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Latest from @{pendingComments[0]?.profiles?.username ?? 'anonymous'} — {pendingComments[0]?.body?.slice(0, 80)}…
              </p>
            </div>
            <span className="text-sm font-bold text-blue-400">→</span>
          </div>
        </Link>
      )}
    </div>
  )
}
