import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BulkContentList } from '@/components/workspace/BulkContentList'

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function MyReviewsPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, status, rating, created_at, updated_at, slug, rejection_reason, image_url')
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

      {/* Reviews list with bulk actions */}
      {!displayed?.length && !filter && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-500 text-lg mb-2">No reviews yet, Boss.</p>
          <Link href="/dashboard/reviews/new" className="text-orange-400 hover:text-orange-300 text-sm">
            Write your first one →
          </Link>
        </div>
      )}
      {(displayed?.length || filter) && (
        <BulkContentList
          contentType="reviews"
          items={(displayed ?? []).map((r) => ({
            id:                   r.id,
            title:                r.title,
            category:             r.category,
            status:               r.status,
            slug:                 r.slug,
            created_at:           r.created_at,
            updated_at:           r.updated_at,
            reading_time_minutes: null,
            rejection_reason:     r.rejection_reason,
            image_url:            r.image_url,
            product_name:         r.product_name,
            rating:               r.rating,
          }))}
          emptyMessage={filter ? `No ${filter} reviews.` : 'No reviews yet.'}
        />
      )}
    </div>
  )
}
