import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryLabel, getCategoryBySlug } from '@/lib/categories'
import { getBadgesByProductSlug } from '@/lib/collection-listings'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import ReviewsGrid from './_components/ReviewsGrid'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import BenchStrip from '@/components/BenchStrip'
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

  // ── All view — featured card + per-category editorial row sections ──
  if (!category) {
    const { data } = await supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, featured')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(200)

    const rawReviews = (data ?? []) as ReviewRow[]
    // Batch-fetch collection badges for every visible product in one query so
    // ReviewCard can render chips per row without N+1.
    const slugsForBadges = rawReviews.map((r) => r.product_slug).filter((s): s is string => Boolean(s))
    const badgeMap = await getBadgesByProductSlug(supabase, slugsForBadges)
    const reviews: ReviewRow[] = rawReviews.map((r) => ({
      ...r,
      badges: r.product_slug ? badgeMap.get(r.product_slug) ?? [] : [],
    }))

    const sections = CATEGORIES
      .map(cat => ({
        cat,
        items: reviews.filter(r => r.category === cat.slug).slice(0, 3),
        total: reviews.filter(r => r.category === cat.slug).length,
      }))
      .filter(s => s.items.length > 0)

    // Featured card preference order: admin-flagged > highest-rated (the latter
    // preserves prior behavior when nothing has been flagged yet).
    const featured =
      reviews.find((r) => r.featured && r.image_url) ??
      reviews.filter((r) => r.image_url).sort((a, b) => b.rating - a.rating)[0] ??
      null

    const categoryCount = new Set(reviews.map(r => r.category)).size
    const avgRating = reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : null
    const lastAdded = reviews[0]?.published_at
      ? new Date(reviews[0].published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null

    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Page header — tick-line eyebrow pattern */}
        <div className="mb-8">
          <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">The Stuff</p>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-prose tracking-tight">All Reviews</h1>
        </div>

        {/* Stats bar */}
        {reviews.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-4 border-b border-soft/40 text-sm text-prose-faint">
            <span><span className="text-prose font-bold tabular-nums">{reviews.length}</span> dad-tested {reviews.length === 1 ? 'review' : 'reviews'}</span>
            <span className="text-prose-faint hidden sm:block">·</span>
            <span><span className="text-prose font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}</span>
            {avgRating && <>
              <span className="text-prose-faint hidden sm:block">·</span>
              <span>Avg rating <span className="text-accent-text-soft font-bold tabular-nums">{avgRating}/10</span></span>
            </>}
            {lastAdded && <>
              <span className="text-prose-faint hidden sm:block">·</span>
              <span>Last added <span className="text-prose font-medium">{lastAdded}</span></span>
            </>}
          </div>
        )}

        {/* Category filter — horizontal scroll strip */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
          <Link
            href="/reviews"
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-accent text-white border border-accent transition-colors"
          >
            All Reviews
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews/category/${c.slug}`}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors"
            >
              <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
              <span>{c.label}</span>
            </Link>
          ))}
        </div>

        {/* Featured review — visual hero of the directory page */}
        {featured && (
          <div className="mb-16">
            <FeaturedReviewCard review={featured} />
          </div>
        )}

        {/* Per-category sections — editorial rows (newspaper directory style)
            replaces the prior 8 identical 3-col card grids with a tighter,
            scannable list per category. Featured card above does the visual
            heavy-lifting; these are quick browse-and-tap entries. */}
        {sections.length === 0 ? (
          <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
            <p className="text-prose-faint text-lg font-semibold">No reviews here yet.</p>
            <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
          </div>
        ) : (
          sections.map(({ cat, items, total }, i) => (
            <section key={cat.slug} className={i > 0 ? 'mt-12' : ''}>
              <div className="flex items-end justify-between mb-5 gap-4">
                <div className="min-w-0">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <h2 className="text-xl md:text-2xl font-black text-prose flex items-center gap-2.5 leading-tight">
                    <CategoryIcon slug={cat.slug} className="w-5 h-5 sm:w-6 sm:h-6 text-accent-text shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </h2>
                  {cat.description && (
                    <p className="text-sm text-prose-faint mt-1.5 line-clamp-1">{cat.description}</p>
                  )}
                </div>
                {total > items.length && (
                  <Link
                    href={`/reviews/category/${cat.slug}`}
                    className="self-end shrink-0 text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold"
                  >
                    View all {total}
                  </Link>
                )}
              </div>
              <div className="divide-y divide-soft">
                {items.map((r) => <ReviewRow key={r.id} review={r} />)}
              </div>
            </section>
          ))
        )}

        {/* On the Bench — what's coming next */}
        <div className="mt-16">
          <BenchStrip ctaText="See all on the bench" />
        </div>
      </div>
    )
  }

  // ── Filtered view — flat card grid (deep browse surface) ──────────────
  const cat = getCategoryBySlug(category)
  const { data, count } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('category', category as any)
    .order('published_at', { ascending: false })
    .range(0, PER_PAGE - 1)

  const rawReviews = (data ?? []) as ReviewRow[]
  const slugsForBadges = rawReviews.map((r) => r.product_slug).filter((s): s is string => Boolean(s))
  const badgeMap = await getBadgesByProductSlug(supabase, slugsForBadges)
  const reviews: ReviewRow[] = rawReviews.map((r) => ({
    ...r,
    badges: r.product_slug ? badgeMap.get(r.product_slug) ?? [] : [],
  }))

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Page header — tick-line eyebrow + breadcrumb */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">
          Reviews / {getCategoryLabel(category).toUpperCase()}
        </p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-prose tracking-tight flex items-center gap-3">
          {cat && <CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text" />}
          <span>{getCategoryLabel(category)}</span>
        </h1>
        {cat?.description && (
          <p className="text-prose-muted mb-2 max-w-2xl">{cat.description}</p>
        )}
        <p className="text-prose-faint text-sm tabular-nums">
          {count ?? 0} dad-tested {(count ?? 0) === 1 ? 'review' : 'reviews'}
        </p>
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/reviews"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors"
        >
          All Reviews
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/reviews/category/${c.slug}`}
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              category === c.slug
                ? 'bg-accent text-white border border-accent'
                : 'bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose'
            }`}
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      {!reviews.length ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
          <p className="text-prose-faint text-lg font-semibold">No reviews here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <ReviewsGrid initialItems={reviews} total={count ?? 0} category={category} />
      )}

      {/* On the Bench */}
      <div className="mt-16">
        <BenchStrip ctaText="See all on the bench" />
      </div>
    </div>
  )
}

// Editorial row — image left, title + product name right, rating far right.
// Same geometry as the /gear Solid Gear rows. Used for the per-category
// directory lists on the unfiltered /reviews surface.
function ReviewRow({ review: r }: { review: ReviewRow }) {
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group flex items-center gap-5 py-5 -mx-4 px-4 rounded-xl hover:bg-surface/40 transition-colors"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-raised shrink-0">
        {r.image_url ? (
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 80px, 96px"
          />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-center justify-center">
            <CategoryIcon slug={r.category} className="w-6 h-6 text-accent-text/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base md:text-lg font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug">
          {r.title}
        </h3>
        <p className="text-xs text-prose-faint mt-1 truncate">{r.product_name}</p>
      </div>
      <div className="shrink-0">
        <RatingScore rating={r.rating ?? 0} />
      </div>
    </Link>
  )
}
