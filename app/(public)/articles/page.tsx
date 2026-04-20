import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import ArticleCard from './_components/ArticleCard'
import ArticlesGrid from './_components/ArticlesGrid'
const PER_PAGE = 12
import type { ArticleRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Articles — Boss Daddy Life',
  description: 'Dad guides, how-tos, and honest advice. No fluff — just what works.',
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ArticlesPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  // ── All view — category sections ──────────────────────────────────────
  if (!category) {
    const { data } = await supabase
      .from('articles')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })

    const articles = (data ?? []) as ArticleRow[]

    const sections = CATEGORIES
      .map(cat => ({
        cat,
        items: articles.filter(a => a.category === cat.slug).slice(0, 3),
        total: articles.filter(a => a.category === cat.slug).length,
      }))
      .filter(s => s.items.length > 0)

    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">Articles</h1>
          <p className="text-gray-500">
            {articles.length} {articles.length === 1 ? 'article' : 'articles'} — guides, tips, and dad wisdom
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-12 pb-1">
          <span className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-orange-600 text-white">
            All
          </span>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/articles?category=${c.slug}`}
              className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-colors"
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-lg">No articles here yet.</p>
            <p className="text-gray-700 text-sm mt-2">Check back soon, Boss.</p>
          </div>
        ) : (
          sections.map(({ cat, items, total }, i) => (
            <section key={cat.slug}>
              {i > 0 && <div className="border-t border-gray-800 mb-12" />}
              <div className="flex items-start justify-between mb-6">
                <div className="border-l-2 border-orange-600 pl-4">
                  <h2 className="text-xl font-black">{cat.icon} {cat.label}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{cat.description}</p>
                </div>
                {total > items.length && (
                  <Link
                    href={`/articles?category=${cat.slug}`}
                    className="text-sm text-orange-500 hover:text-orange-400 font-medium shrink-0 ml-6 mt-1 transition-colors"
                  >
                    View all {total} →
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                {items.map((a, j) => <ArticleCard key={a.id} article={a} priority={i === 0 && j < 3} />)}
              </div>
            </section>
          ))
        )}
      </div>
    )
  }

  // ── Filtered view — flat grid + load more ─────────────────────────────
  const cat = getCategoryBySlug(category)
  const { data, count } = await supabase
    .from('articles')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', category)
    .order('published_at', { ascending: false })
    .range(0, PER_PAGE - 1)

  const articles = (data ?? []) as ArticleRow[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-black mb-2">
          {cat ? `${cat.icon} ${cat.label}` : 'Articles'}
        </h1>
        {cat?.description && (
          <p className="text-gray-400 mb-1">{cat.description}</p>
        )}
        <p className="text-gray-600 text-sm">
          {count ?? 0} {(count ?? 0) === 1 ? 'article' : 'articles'}{cat ? ` in ${cat.label}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-10 pb-1">
        <Link
          href="/articles"
          className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-colors"
        >
          All
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/articles?category=${c.slug}`}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              category === c.slug
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {c.icon} {c.label}
          </Link>
        ))}
      </div>

      {!articles.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-600 text-lg">No articles here yet.</p>
          <p className="text-gray-700 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <ArticlesGrid initialItems={articles} total={count ?? 0} category={category} />
      )}
    </div>
  )
}
