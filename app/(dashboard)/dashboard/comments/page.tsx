import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { CommentActions } from './_components/CommentActions'

interface Props {
  searchParams: Promise<{ status?: string }>
}

const STATUS_TABS = [
  { key: 'pending',  label: 'Pending',  color: 'text-amber-600' },
  { key: 'approved', label: 'Approved', color: 'text-green-700'  },
  { key: 'rejected', label: 'Rejected', color: 'text-red-600'    },
]

export default async function CommentsPage({ searchParams }: Props) {
  const { status = 'pending' } = await searchParams
  const admin = createAdminClient()

  const { data: comments } = await admin
    .from('comments')
    .select('id, body, content_type, content_id, status, created_at, moderation_score, moderation_flags, profiles(username)')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(100)

  // Counts per status (run in parallel)
  const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
    admin.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ])
  const counts = {
    pending:  pendingCount.count  ?? 0,
    approved: approvedCount.count ?? 0,
    rejected: rejectedCount.count ?? 0,
  }

  // Lookup article/review titles for the comments in view
  const reviewIds  = Array.from(new Set((comments ?? []).filter(c => c.content_type === 'review').map(c => c.content_id)))
  const articleIds = Array.from(new Set((comments ?? []).filter(c => c.content_type === 'guide').map(c => c.content_id)))

  const [{ data: reviewTitles }, { data: articleTitles }] = await Promise.all([
    reviewIds.length  ? admin.from('reviews').select('id, title, slug').in('id', reviewIds)    : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
    articleIds.length ? admin.from('guides').select('id, title, slug').in('id', articleIds) : Promise.resolve({ data: [] as { id: string; title: string; slug: string }[] }),
  ])

  const contentMap = new Map<string, { title: string; slug: string; type: string }>([
    ...(reviewTitles  ?? []).map(r => [r.id, { title: r.title, slug: r.slug, type: 'review' }]  as [string, { title: string; slug: string; type: string }]),
    ...(articleTitles ?? []).map(a => [a.id, { title: a.title, slug: a.slug, type: 'guide' }] as [string, { title: string; slug: string; type: string }]),
  ])

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black">Comments</h1>
        <p className="text-prose-faint text-sm mt-1">Review pending comments and manage reader engagement.</p>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex gap-1 bg-surface border border-soft rounded-xl p-1 w-fit max-w-full overflow-x-auto scrollbar-hide">
        {STATUS_TABS.map((t) => {
          const active = status === t.key
          const count = counts[t.key as keyof typeof counts]
          return (
            <Link
              key={t.key}
              href={`/dashboard/comments?status=${t.key}`}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap ${
                active ? 'bg-surface-raised text-prose' : 'text-prose-faint hover:text-prose'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${active ? 'bg-accent text-white' : 'bg-surface-raised text-prose-faint'}`}>
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Comments list */}
      {!comments?.length ? (
        <div className="text-center py-24 border border-dashed border-soft rounded-2xl">
          <p className="text-2xl mb-2">{status === 'pending' ? '✅' : '—'}</p>
          <p className="text-prose-muted font-semibold">No {status} comments.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => {
            const author  = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles as unknown as { username: string } | null)?.username ?? 'unknown'
            const content = contentMap.get(c.content_id)
            const href    = content ? `/${content.type}s/${content.slug}` : null
            const score   = c.moderation_score as number | null
            const flags   = (c.moderation_flags ?? []) as string[]

            return (
              <div key={c.id} className="p-4 bg-surface border border-soft rounded-2xl">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    c.content_type === 'review'
                      ? 'bg-accent-tint text-accent-text-soft border-accent-border/30'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {c.content_type === 'review' ? 'Review' : 'Guide'}
                  </span>
                  <span className="text-xs text-prose-faint">by @{author}</span>
                  <span className="text-xs text-prose-faint">
                    {new Date(c.created_at ?? '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {score !== null && (
                    <span className={`text-xs font-mono ${
                      score >= 0.7 ? 'text-red-600' : score >= 0.4 ? 'text-amber-600' : 'text-green-700'
                    }`}>
                      {score.toFixed(2)}
                    </span>
                  )}
                </div>

                {content && href && (
                  <Link
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-prose-muted hover:text-accent-text-soft transition-colors block mb-2 truncate"
                  >
                    ↗ {content.title}
                  </Link>
                )}

                <p className="text-sm text-prose-muted leading-relaxed mb-3 whitespace-pre-wrap">{c.body}</p>

                {flags.length > 0 && (
                  <p className="text-xs text-red-600/80 mb-3">
                    ⚑ {flags.slice(0, 3).join(' · ')}{flags.length > 3 ? ` +${flags.length - 3} more` : ''}
                  </p>
                )}

                {status === 'pending' && <CommentActions id={c.id} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
