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

export default async function MyArticlesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: articles } = await supabase
    .from('articles')
    .select('id, title, category, status, slug, created_at, updated_at, reading_time_minutes, rejection_reason')
    .eq('author_id', user!.id)
    .order('updated_at', { ascending: false })

  const counts = {
    total:   articles?.length ?? 0,
    live:    articles?.filter(a => a.status === 'approved').length ?? 0,
    pending: articles?.filter(a => a.status === 'pending').length ?? 0,
    draft:   articles?.filter(a => a.status === 'draft').length ?? 0,
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl font-black">My Articles</h1>
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: 'Total',   value: counts.total,   color: 'text-white' },
          { label: 'Live',    value: counts.live,    color: 'text-green-400' },
          { label: 'Pending', value: counts.pending, color: 'text-yellow-400' },
          { label: 'Drafts',  value: counts.draft,   color: 'text-gray-400' },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 sm:px-5 sm:py-4">
            <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Articles list */}
      {!articles?.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-500 text-lg mb-2">No articles yet, Boss.</p>
          <Link href="/dashboard/articles/new" className="text-orange-400 hover:text-orange-300 text-sm">
            Write your first one →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => {
            const status = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.draft
            const category = getCategoryBySlug(a.category)

            return (
              <div
                key={a.id}
                className="p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Article icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center shrink-0 text-lg mt-0.5">
                    {category?.icon ?? '📝'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm leading-snug">{a.title}</p>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {category && (
                        <span className={`text-xs ${category.accent}`}>
                          {category.icon} {category.label}
                        </span>
                      )}
                      {a.reading_time_minutes && (
                        <span className="text-xs text-gray-600">{a.reading_time_minutes} min read</span>
                      )}
                      <span className="text-xs text-gray-700">
                        {new Date(a.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    {a.rejection_reason && (
                      <p className="text-xs text-yellow-400/80 mt-1.5">
                        ↩ Edits requested: {a.rejection_reason}
                      </p>
                    )}
                    {/* Actions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {['draft', 'rejected'].includes(a.status) && (
                        <Link
                          href={`/dashboard/articles/${a.id}/edit`}
                          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg transition-colors"
                        >
                          Edit
                        </Link>
                      )}
                      {a.status === 'approved' && a.slug && (
                        <Link
                          href={`/articles/${a.slug}`}
                          target="_blank"
                          className="text-xs px-3 py-1.5 bg-orange-950/50 hover:bg-orange-900/50 text-orange-400 hover:text-orange-300 rounded-lg transition-colors border border-orange-900/40"
                        >
                          View Live →
                        </Link>
                      )}
                      <ContentActions id={a.id} status={a.status} contentType="articles" />
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
