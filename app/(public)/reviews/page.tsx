import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryLabel, getCategoryBySlug } from '@/lib/categories'
import ReviewCard from './_components/ReviewCard'
import ReviewsGrid from './_components/ReviewsGrid'
const PER_PAGE = 12
import type { ReviewRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad-Tested Product Reviews',
  description: 'Every product on Boss Daddy Life is bought with our own money, used in real life, and rated honestly. Browse gear reviews across tools, grills, outdoor, tech, and more.',
  openGraph: {
    title: 'Dad-Tested Product Reviews — Boss Daddy Life',
    description: 'Every product bought with our own money, used in real life, and rated honestly. No sponsored posts. No fluff.',
    images: [{ url: '/api/og?title=Dad-Tested+Product+Reviews&type=review', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad-Tested Product Reviews — Boss Daddy Life',
  },
  alternates: { canonical: '/reviews' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ReviewsPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  // ── All view — category sections ──────────────────────────────────────
  if (!category) {
    const { data } = await supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })

    const reviews = (data ?? []) as ReviewRow[]

    const sections = CATEGORIES
      .map(cat => ({
        cat,
        items: reviews.filter(r => r.category === cat.slug).slice(0, 3),
        total: reviews.filter(r => r.category === cat.slug).length,
      }))
      .filter(s => s.items.length > 0)

    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">All Reviews</h1>
          <p className="text-gray-500">
            {reviews.length} dad-tested {reviews.length === 1 ? 'review' : 'reviews'} across {sections.length} {sections.length === 1 ? 'category' : 'categories'}
          </p>
        </div>

        <div className="-mx-6 overflow-x-auto scrollbar-hide mb-12">
          <div className="flex items-center gap-2 px-6 pb-1">
            <span className="shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium bg-orange-600 text-white">
              All
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/reviews?category=${c.slug}`}
                className="shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-colors"
              >
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-lg">No reviews here yet.</p>
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
                    href={`/reviews?category=${cat.slug}`}
                    className="text-sm text-orange-400 hover:text-orange-300 font-medium shrink-0 ml-6 py-2 transition-colors"
                  >
                    View all {total} →
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                {items.map((r, i) => <ReviewCard key={r.id} review={r} priority={i < 3} />)}
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
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', category)
    .order('published_at', { ascending: false })
    .range(0, PER_PAGE - 1)

  const reviews = (data ?? []) as ReviewRow[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-black mb-2">
          {cat?.icon} {getCategoryLabel(category)}
        </h1>
        {cat?.description && (
          <p className="text-gray-400 mb-1">{cat.description}</p>
        )}
        <p className="text-gray-600 text-sm">
          {count ?? 0} dad-tested {(count ?? 0) === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-10">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/reviews"
            className="shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white transition-colors"
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews?category=${c.slug}`}
              className={`shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                category === c.slug
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>
      </div>

      {!reviews.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-600 text-lg">No reviews here yet.</p>
          <p className="text-gray-700 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <ReviewsGrid initialItems={reviews} total={count ?? 0} category={category} />
      )}
    </div>
  )
}
