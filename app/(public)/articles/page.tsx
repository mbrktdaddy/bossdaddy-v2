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
  title: 'Dad Guides, Skills & Advice',
  description: 'Real guides for real dads — gear how-tos, backyard projects, grilling tips, and practical advice from a dad who actually tested it. No fluff, just what works.',
  openGraph: {
    title: 'Dad Guides, Skills & Advice — Boss Daddy Life',
    description: 'Real guides for real dads. Gear how-tos, backyard projects, grilling tips, and practical advice. No fluff.',
    images: [{ url: '/api/og?title=Dad+Guides+%26+Advice&type=article', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad Guides, Skills & Advice — Boss Daddy Life',
  },
  alternates: { canonical: '/articles' },
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
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-12">
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— The Field Notes</p>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">Articles</h1>
          <p className="text-gray-500 text-sm tabular-nums">
            {articles.length} {articles.length === 1 ? 'article' : 'articles'} — guides, tips, and dad wisdom
          </p>
        </div>

        <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
          <div className="flex items-center gap-2 px-6 pb-1">
            <span className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white shadow-md shadow-black/30">
              All
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/articles?category=${c.slug}`}
                className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
              >
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-gray-500 text-lg font-semibold">No articles here yet.</p>
            <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
          </div>
        ) : (
          sections.map(({ cat, items, total }, i) => (
            <section key={cat.slug} className={i > 0 ? 'mt-16' : ''}>
              <div className="flex items-stretch justify-between mb-6 gap-4">
                <div className="flex items-stretch gap-4">
                  <div className="w-[3px] bg-orange-600 rounded-full" />
                  <div>
                    <p className="text-[11px] text-orange-500 uppercase tracking-[0.18em] font-bold mb-1">{cat.icon} {cat.label}</p>
                    <h2 className="text-xl md:text-2xl font-black text-white">{cat.label}</h2>
                    {cat.description && <p className="text-sm text-gray-500 mt-1">{cat.description}</p>}
                  </div>
                </div>
                {total > items.length && (
                  <Link
                    href={`/articles?category=${cat.slug}`}
                    className="self-end shrink-0 text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
                  >
                    View all {total} →
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Articles{cat ? ` / ${cat.label.toUpperCase()}` : ''}</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">
          {cat ? `${cat.icon} ${cat.label}` : 'Articles'}
        </h1>
        {cat?.description && (
          <p className="text-gray-400 mb-2 max-w-2xl">{cat.description}</p>
        )}
        <p className="text-gray-500 text-sm tabular-nums">
          {count ?? 0} {(count ?? 0) === 1 ? 'article' : 'articles'}{cat ? ` in ${cat.label}` : ''}
        </p>
      </div>

      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/articles"
            className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/articles?category=${c.slug}`}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                category === c.slug
                  ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40'
              }`}
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>
      </div>

      {!articles.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">No articles here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <ArticlesGrid initialItems={articles} total={count ?? 0} category={category} />
      )}
    </div>
  )
}
