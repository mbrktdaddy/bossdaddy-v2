import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import type { Metadata } from 'next'

export const revalidate = 3600

interface Props {
  params: Promise<{ username: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params
  return {
    title: `@${username} — Boss Daddy Life`,
    description: `Reviews and articles by @${username} on Boss Daddy Life.`,
  }
}

export default async function AuthorPage({ params }: Props) {
  const { username } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, role')
    .eq('username', username)
    .single()

  if (!profile) notFound()

  const [{ data: reviews }, { data: articles }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, published_at')
      .eq('author_id', profile.id)
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    supabase
      .from('articles')
      .select('id, slug, title, category, excerpt, published_at, reading_time_minutes')
      .eq('author_id', profile.id)
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
  ])

  const totalReviews = reviews?.length ?? 0
  const totalArticles = articles?.length ?? 0

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">

      {/* Profile header */}
      <div className="flex items-start gap-5 mb-12 pb-10 border-b border-gray-800">
        <div className="w-16 h-16 rounded-2xl bg-orange-600 flex items-center justify-center text-2xl font-black text-white shrink-0">
          {username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-black mb-1">@{username}</h1>
          <p className="text-gray-500 text-sm">
            {profile.role === 'admin' ? 'Editor' : 'Contributor'} · Boss Daddy Life
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <span><span className="text-white font-semibold">{totalReviews}</span> {totalReviews === 1 ? 'review' : 'reviews'}</span>
            <span><span className="text-white font-semibold">{totalArticles}</span> {totalArticles === 1 ? 'article' : 'articles'}</span>
          </div>
        </div>
      </div>

      {/* Reviews */}
      {totalReviews > 0 && (
        <div className="mb-12">
          <h2 className="text-lg font-black mb-5">Reviews</h2>
          <div className="space-y-2">
            {reviews!.map((r) => {
              const cat = getCategoryBySlug(r.category)
              return (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-orange-700/50 rounded-2xl transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2 py-0.5 rounded-full">
                        {r.product_name}
                      </span>
                      {cat && <span className={`text-xs ${cat.accent}`}>{cat.icon} {cat.label}</span>}
                    </div>
                    <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{r.title}</p>
                    {r.published_at && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className="text-sm text-yellow-400 font-bold ml-4 shrink-0">
                    {'★'.repeat(r.rating)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Articles */}
      {totalArticles > 0 && (
        <div>
          <h2 className="text-lg font-black mb-5">Articles</h2>
          <div className="space-y-2">
            {articles!.map((a) => {
              const cat = getCategoryBySlug(a.category)
              return (
                <Link
                  key={a.id}
                  href={`/articles/${a.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-orange-700/50 rounded-2xl transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {cat && <span className={`text-xs ${cat.accent}`}>{cat.icon} {cat.label}</span>}
                    </div>
                    <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{a.title}</p>
                    {a.published_at && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {a.reading_time_minutes && (
                    <span className="text-xs text-gray-600 ml-4 shrink-0">{a.reading_time_minutes} min</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {totalReviews === 0 && totalArticles === 0 && (
        <div className="text-center py-16 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-500">No published content yet.</p>
        </div>
      )}

    </div>
  )
}
