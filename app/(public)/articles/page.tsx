import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import Pagination from '@/components/Pagination'
import type { Metadata } from 'next'

export const revalidate = 3600

const PER_PAGE = 12

export const metadata: Metadata = {
  title: 'Articles — Boss Daddy Life',
  description: 'Dad guides, how-tos, and honest advice. No fluff — just what works.',
}

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>
}

export default async function ArticlesPage({ searchParams }: Props) {
  const { category, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1
  const supabase = await createClient()

  let query = supabase
    .from('articles')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: articles, count } = await query
  const cat = category ? getCategoryBySlug(category) : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* Page title */}
      <div className="mb-10">
        <h1 className="text-3xl font-black mb-2">
          {cat ? `${cat.icon} ${cat.label}` : 'Articles'}
        </h1>
        <p className="text-gray-500">
          {articles?.length ?? 0} {articles?.length === 1 ? 'article' : 'articles'}
          {cat ? ` in ${cat.label}` : ' — guides, tips, and dad wisdom'}
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 flex-wrap mb-10">
        <Link
          href="/articles"
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !category
              ? 'bg-orange-600 text-white'
              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
          }`}
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/articles?category=${c.slug}`}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === c.slug
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {c.icon} {c.label}
          </Link>
        ))}
      </div>

      {/* Articles grid */}
      {!articles?.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-600 text-lg">No articles here yet.</p>
          <p className="text-gray-700 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {articles.map((a) => {
            const articleCat = getCategoryBySlug(a.category)
            return (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
              >
                {a.image_url && (
                  <div className="relative w-full h-40 bg-gray-800 shrink-0 overflow-hidden">
                    <img
                      src={a.image_url}
                      alt={a.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  {articleCat && (
                    <span className={`text-xs font-medium mb-3 ${articleCat.accent}`}>
                      {articleCat.icon} {articleCat.label}
                    </span>
                  )}
                  <h2 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {a.title}
                  </h2>
                  {a.excerpt && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{a.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-600">
                      {a.published_at
                        ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : ''}
                    </span>
                    <div className="flex items-center gap-3">
                      {a.reading_time_minutes && (
                        <span className="text-xs text-gray-600">{a.reading_time_minutes} min read</span>
                      )}
                      <span className="text-xs text-orange-500 font-medium">Read →</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Pagination
        page={page}
        total={count ?? 0}
        perPage={PER_PAGE}
        basePath="/articles"
        params={category ? { category } : {}}
      />
    </div>
  )
}
