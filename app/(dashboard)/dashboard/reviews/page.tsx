import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import ContentActions from '../_components/ContentActions'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:    { label: 'Draft',    className: 'bg-gray-800 text-gray-400 border border-gray-700' },
  pending:  { label: 'Pending',  className: 'bg-yellow-950/60 text-yellow-400 border border-yellow-900/60' },
  approved: { label: 'Live',     className: 'bg-green-950/60 text-green-400 border border-green-900/60' },
  rejected: { label: 'Rejected', className: 'bg-red-950/60 text-red-400 border border-red-900/60' },
}

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function MyReviewsPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, status, rating, created_at, updated_at, slug, rejection_reason')
    .eq('author_id', user!.id)
    .order('updated_at', { ascending: false })

  const counts = {
    total:   reviews?.length ?? 0,
    live:    reviews?.filter(r => r.status === 'approved').length ?? 0,
    pending: reviews?.filter(r => r.status === 'pending').length ?? 0,
    draft:   reviews?.filter(r => ['draft', 'rejected'].includes(r.status)).length ?? 0,
  }

  const displayed = filter === 'live'    ? reviews?.filter(r => r.status === 'approved')
    : filter === 'pending' ? reviews?.filter(r => r.status === 'pending')
    : filter === 'drafts'  ? reviews?.filter(r => ['draft', 'rejected'].includes(r.status))
    : reviews

  const statCards = [
    { label: 'Total',   value: counts.total,   color: 'text-white',      filterKey: null },
    { label: 'Live',    value: counts.live,    color: 'text-green-400',  filterKey: 'live' },
    { label: 'Pending', value: counts.pending, color: 'text-yellow-400', filterKey: 'pending' },
    { label: 'Drafts',  value: counts.draft,   color: 'text-gray-400',   filterKey: 'drafts' },
  ]

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl font-black">My Reviews</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your content</p>
        </div>
        <Link
          href="/dashboard/reviews/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Review
        </Link>
      </div>

      {/* Stats — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {statCards.map((s) => {
          const isActive = filter === s.filterKey || (!filter && s.filterKey === null)
          const href = isActive && s.filterKey !== null
            ? '/dashboard/reviews'
            : s.filterKey ? `/dashboard/reviews?filter=${s.filterKey}` : '/dashboard/reviews'
          return (
            <Link
              key={s.label}
              href={href}
              className={`block bg-gray-900 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 border transition-colors ${
                isActive
                  ? 'border-orange-600 bg-orange-950/20'
                  : 'border-gray-800 hover:border-gray-600'
              }`}
            >
              <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Active filter label */}
      {filter && (
        <div className="flex items-center gap-2 mb-4">
          <p className="text-sm text-gray-500">
            Showing: <span className="text-orange-400 font-medium capitalize">{filter}</span>
          </p>
          <Link href="/dashboard/reviews" className="text-xs text-gray-600 hover:text-gray-400 underline">clear</Link>
        </div>
      )}

      {/* Reviews list */}
      {!displayed?.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          {filter ? (
            <p className="text-gray-500 text-lg">No {filter} reviews.</p>
          ) : (
            <>
              <p className="text-gray-500 text-lg mb-2">No reviews yet, Boss.</p>
              <Link href="/dashboard/reviews/new" className="text-orange-400 hover:text-orange-300 text-sm">
                Write your first one →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((r) => {
            const status = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.draft
            const category = getCategoryBySlug(r.category)

            return (
              <div
                key={r.id}
                className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-bold text-yellow-400">{r.rating}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm leading-snug">{r.title}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">{r.product_name}</span>
                      {category && (
                        <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                      )}
                      <span className="text-xs text-gray-700">
                        {new Date(r.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {r.rejection_reason && ['draft', 'rejected'].includes(r.status) && (
                      <p className="text-xs text-yellow-400/80 mt-1.5">↩ Edits requested: {r.rejection_reason}</p>
                    )}
                    {r.status === 'pending' && (
                      <p className="text-xs text-gray-500 mt-1.5">
                        In review queue — use &ldquo;Recall to draft&rdquo; to pull it back and edit.
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <Link
                        href={`/dashboard/reviews/${r.id}`}
                        className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                      >
                        {['draft', 'rejected'].includes(r.status) ? 'Edit' : 'Open'}
                      </Link>
                      {r.status === 'approved' && (
                        <Link
                          href={`/reviews/${r.slug}`}
                          target="_blank"
                          className="text-xs px-3 py-1.5 bg-orange-950/50 hover:bg-orange-900/50 text-orange-400 hover:text-orange-300 rounded-lg transition-colors border border-orange-900/40"
                        >
                          View Live →
                        </Link>
                      )}
                      <ContentActions id={r.id} status={r.status} contentType="reviews" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
