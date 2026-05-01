import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryLabel, getCategoryBySlug, type CategorySlug } from '@/lib/categories'
import ReviewCard from './_components/ReviewCard'
import ReviewsGrid from './_components/ReviewsGrid'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
const PER_PAGE = 12
import type { ReviewRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad-Tested Product Reviews',
  description: 'Every product on Boss Daddy Life is bought with our own money, used in real life, and rated honestly. Browse our reviews across tools, grills, outdoor, tech, and more.',
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
      .limit(200)

    const reviews = (data ?? []) as ReviewRow[]

    const sections = CATEGORIES
      .map(cat => ({
        cat,
        items: reviews.filter(r => r.category === cat.slug).slice(0, 3),
        total: reviews.filter(r => r.category === cat.slug).length,
      }))
      .filter(s => s.items.length > 0)

    // Featured: highest-rated review with an image
    const featured = reviews
      .filter(r => r.image_url)
      .sort((a, b) => b.rating - a.rating)[0] ?? null

    // Stats
    const categoryCount = new Set(reviews.map(r => r.category)).size
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null
    const lastAdded = reviews[0]?.published_at
      ? new Date(reviews[0].published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null

    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— The Stuff</p>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">All Reviews</h1>
        </div>

        {/* Stats bar */}
        {reviews.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-4 border-b border-gray-800/40 text-sm text-gray-500">
            <span><span className="text-white font-bold tabular-nums">{reviews.length}</span> dad-tested {reviews.length === 1 ? 'review' : 'reviews'}</span>
            <span className="text-gray-700 hidden sm:block">·</span>
            <span><span className="text-white font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}</span>
            {avgRating && <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <span>Avg rating <span className="text-orange-400 font-bold tabular-nums">{avgRating}/10</span></span>
            </>}
            {lastAdded && <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <span>Last added <span className="text-white font-medium">{lastAdded}</span></span>
            </>}
          </div>
        )}

        {/* Featured review */}
        {featured && <FeaturedReviewCard review={featured} />}

        {/* Filter pills */}
        <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
          <div className="flex items-center gap-2 px-6 pb-1">
            <span className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white shadow-md shadow-black/30">
              All
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/reviews/category/${c.slug}`}
                className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
              >
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-gray-500 text-lg font-semibold">No reviews here yet.</p>
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
                    href={`/reviews/category/${cat.slug}`}
                    className="self-end shrink-0 text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
                  >
                    View all {total}
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('category', category as any)
    .order('published_at', { ascending: false })
    .range(0, PER_PAGE - 1)

  const reviews = (data ?? []) as ReviewRow[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Page header — eyebrow + h1 + count */}
      <div className="mb-12">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Reviews / {getCategoryLabel(category).toUpperCase()}</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">
          {cat?.icon} {getCategoryLabel(category)}
        </h1>
        {cat?.description && (
          <p className="text-gray-400 mb-2 max-w-2xl">{cat.description}</p>
        )}
        <p className="text-gray-500 text-sm tabular-nums">
          {count ?? 0} dad-tested {(count ?? 0) === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      {/* Filter pills */}
      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/reviews"
            className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews/category/${c.slug}`}
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

      {!reviews.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">No reviews here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <ReviewsGrid initialItems={reviews} total={count ?? 0} category={category} />
      )}
    </div>
  )
}
