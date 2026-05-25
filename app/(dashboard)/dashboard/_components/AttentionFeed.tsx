import Link from 'next/link'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'

type PendingItem = {
  id: string
  title: string
  category: string
  moderation_score: number | null
  moderation_flags: string[] | null
  created_at: string | null
  type: 'guide' | 'review'
}

type PendingComment = {
  id: string
  body: string
  created_at: string | null
  profiles?: { username: string } | null
}

interface Props {
  pendingItems: PendingItem[]
  pendingComments: PendingComment[]
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
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
      <div className="bg-surface border border-soft rounded-xl p-8 text-center">
        <svg className="w-8 h-8 text-forest mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-prose-muted font-semibold">All clear.</p>
        <p className="text-prose-faint text-sm mt-1">Nothing needs your attention right now.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {pendingItems.map((item) => {
        const score = item.moderation_score
        const category = getCategoryBySlug(item.category)
        const isHighRisk = score !== null && score >= 0.7
        const href = item.type === 'guide'
          ? `/dashboard/guides/${item.id}`
          : `/dashboard/reviews/${item.id}`

        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={href}
            className="block bg-surface border border-soft hover:border-strong rounded-xl p-4 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    item.type === 'guide'
                      ? 'bg-blue-950/40 text-blue-300 border-blue-700/40'
                      : 'bg-accent-tint text-accent-text-soft border-accent-border/40'
                  }`}>
                    {item.type === 'guide' ? 'Guide' : 'Review'}
                  </span>
                  {category && <span className={`flex items-center gap-1 text-xs ${category.accent}`}><CategoryIcon slug={category.slug} className="w-3.5 h-3.5 text-accent-text" /> {category.label}</span>}
                  <span className="text-xs text-prose-faint">{timeAgo(item.created_at)}</span>
                </div>
                <p className="text-sm font-semibold truncate">{item.title}</p>
                {item.moderation_flags && item.moderation_flags.length > 0 && (
                  <p className="text-xs text-red-300/80 mt-1 truncate">
                    ⚑ {item.moderation_flags.slice(0, 2).join(' · ')}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                {score === null ? (
                  <span className="text-xs text-prose-faint font-mono">—</span>
                ) : (
                  <span className={`text-sm font-mono font-bold ${
                    isHighRisk ? 'text-red-300' : score >= 0.4 ? 'text-amber-300' : 'text-forest'
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
          className="block bg-surface border border-soft hover:border-strong rounded-xl p-4 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {pendingComments.length} pending comment{pendingComments.length > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-prose-faint mt-0.5 truncate">
                Latest from @{pendingComments[0]?.profiles?.username ?? 'anonymous'} — {pendingComments[0]?.body?.slice(0, 80)}…
              </p>
            </div>
            <span className="text-sm font-bold text-blue-300">→</span>
          </div>
        </Link>
      )}
    </div>
  )
}
