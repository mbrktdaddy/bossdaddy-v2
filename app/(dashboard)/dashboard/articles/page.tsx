import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth-cache'
import { BulkContentList } from '@/components/workspace/BulkContentList'

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function MyArticlesPage({ searchParams }: Props) {
  const { filter } = await searchParams
  const user = await requireUser()
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, category, status, slug, created_at, updated_at, reading_time_minutes, rejection_reason, image_url')
    .eq('author_id', user.id)
    .order('updated_at', { ascending: false })

  const counts = {
    total:   articles?.length ?? 0,
    live:    articles?.filter(a => a.status === 'approved').length ?? 0,
    pending: articles?.filter(a => a.status === 'pending').length ?? 0,
    draft:   articles?.filter(a => ['draft', 'rejected'].includes(a.status)).length ?? 0,
  }

  const displayed = filter === 'live'    ? articles?.filter(a => a.status === 'approved')
    : filter === 'pending' ? articles?.filter(a => a.status === 'pending')
    : filter === 'drafts'  ? articles?.filter(a => ['draft', 'rejected'].includes(a.status))
    : articles

  const statCards = [
    { label: 'Total',   value: counts.total,   color: 'text-white',        filterKey: null },
    { label: 'Live',    value: counts.live,    color: 'text-green-400',    filterKey: 'live' },
    { label: 'Pending', value: counts.pending, color: 'text-yellow-400',   filterKey: 'pending' },
    { label: 'Drafts',  value: counts.draft,   color: 'text-gray-400',     filterKey: 'drafts' },
  ]

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl font-black">My Guides</h1>
          <p className="text-gray-500 text-sm mt-1">Guides, how-tos, and dad wisdom</p>
        </div>
        <Link
          href="/dashboard/articles/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Article
        </Link>
      </div>

      {/* Stats — clickable filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {statCards.map((s) => {
          const isActive = filter === s.filterKey || (!filter && s.filterKey === null)
          const href = isActive && s.filterKey !== null
            ? '/dashboard/articles'
            : s.filterKey ? `/dashboard/articles?filter=${s.filterKey}` : '/dashboard/articles'
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
          <Link href="/dashboard/articles" className="text-xs text-gray-600 hover:text-gray-400 underline">clear</Link>
        </div>
      )}

      {/* Articles list with bulk actions */}
      {!displayed?.length && !filter && (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-500 text-lg mb-2">No articles yet, Boss.</p>
          <Link href="/dashboard/articles/new" className="text-orange-400 hover:text-orange-300 text-sm">
            Write your first one →
          </Link>
        </div>
      )}
      {(displayed?.length || filter) && (
        <BulkContentList
          contentType="articles"
          items={(displayed ?? []).map((a) => ({
            id:                   a.id,
            title:                a.title,
            category:             a.category,
            status:               a.status,
            slug:                 a.slug,
            created_at:           a.created_at,
            updated_at:           a.updated_at,
            reading_time_minutes: a.reading_time_minutes,
            rejection_reason:     a.rejection_reason,
            image_url:            a.image_url,
          }))}
          emptyMessage={filter ? `No ${filter} articles.` : 'No articles yet.'}
        />
      )}
    </div>
  )
}
