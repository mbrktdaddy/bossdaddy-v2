import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug, type CategorySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import { MerchPanel } from '@/app/(public)/gear/_components/MerchPanel'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import BenchStrip from '@/components/BenchStrip'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Boss Daddy's Stuff — Field-Tested Picks",
  description: 'Every product Boss Daddy has personally bought, tested, and stands behind — sorted by rating. The only list where every pick is earned, not sponsored. Plus branded goods, made by a real dad.',
  openGraph: {
    title: "Boss Daddy's Stuff — Boss Daddy Life",
    description: 'Every product personally bought, tested, and rated. Field-tested by a real dad. And, soon, made by one.',
    images: [{ url: '/api/og?title=Boss+Daddy+Stuff&type=review', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Boss Daddy's Stuff — Boss Daddy Life",
  },
  alternates: { canonical: '/stuff' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function StuffPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .gte('rating', 8)
    .order('rating', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(120)

  if (category) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq('category', category as any)
  }

  const { data: reviews } = await query
  const topPicks = reviews ?? []
  const cat = category ? getCategoryBySlug(category) : null

  // Stats
  const categoryCount = new Set(topPicks.map(r => r.category)).size
  const highestRating = topPicks[0]?.rating ?? null
  const bossPicks = topPicks.filter(r => (r.rating ?? 0) >= 9).length

  // #1 Pick hero — highest rated with an image
  const topPick = !category ? (topPicks.find(r => r.image_url) ?? null) : null

  // Tier groups (only on unfiltered view)
  const tens   = topPicks.filter(r => (r.rating ?? 0) === 10)
  const nines  = topPicks.filter(r => (r.rating ?? 0) >= 9 && (r.rating ?? 0) < 10)
  const eights = topPicks.filter(r => (r.rating ?? 0) >= 8 && (r.rating ?? 0) < 9)

  const tiers = [
    { label: '🏆 Perfect Score', sub: 'Flawless. Nothing I tested came close.',                          items: tens },
    { label: '⭐ Boss Picks',     sub: 'Earned it. These are the ones I recommend without hesitation.',   items: nines },
    { label: '👍 Solid Stuff',   sub: 'Good enough that I kept them. Not perfect, but worth it.',        items: eights },
  ].filter(t => t.items.length > 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">

      {/* Page header */}
      <div className="mb-8">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Daddy Tested, Boss Approved</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">
          {cat ? `${cat.icon} ${cat.label} Stuff` : "Boss Daddy's Favorite Stuff"}
        </h1>
        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl">
          I know we shouldn&apos;t pray for stuff, but here&apos;s a list of some really cool stuff.
        </p>
      </div>

      {/* Stats bar */}
      {topPicks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-4 border-b border-gray-800/40 text-sm text-gray-500">
          <span><span className="text-white font-bold tabular-nums">{topPicks.length}</span> {topPicks.length === 1 ? 'pick' : 'picks'} rated 8+</span>
          <span className="text-gray-700 hidden sm:block">·</span>
          <span><span className="text-white font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}</span>
          {bossPicks > 0 && <>
            <span className="text-gray-700 hidden sm:block">·</span>
            <span><span className="text-orange-400 font-bold tabular-nums">{bossPicks}</span> Boss {bossPicks === 1 ? 'Pick' : 'Picks'} (9+)</span>
          </>}
          {highestRating && <>
            <span className="text-gray-700 hidden sm:block">·</span>
            <span>Top rated <span className="text-white font-bold tabular-nums">{highestRating}/10</span></span>
          </>}
        </div>
      )}

      {/* Category filter pills */}
      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-10">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/stuff"
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
              !category
                ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40'
            }`}
          >
            All Stuff
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/stuff?category=${c.slug}`}
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

      {/* Boss Daddy Merch panel */}
      <MerchPanel />

      {/* #1 Pick hero (unfiltered view only) */}
      {topPick && (
        <FeaturedReviewCard review={{ ...topPick, rating: topPick.rating ?? 0 }} label="Boss's #1 Pick" />
      )}

      {/* More coming — bench strip */}
      <div className="mb-14">
        <p className="text-xs text-gray-500 mb-3">More stuff is on the way. Vote on what gets tested next.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      {/* Content */}
      {!topPicks.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">Nothing here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Reviews are being added.</p>
        </div>
      ) : category ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((r) => <StuffCard key={r.id} review={r} />)}
        </div>
      ) : (
        <div>
          {tiers.map(({ label, sub, items }, i) => {
            const isLast = i === tiers.length - 1
            const isPerfect = label.includes('Perfect Score')
            const bottomMargin = isLast ? '' : isPerfect ? 'mb-24' : 'mb-16'
            return (
              <section key={label} className={bottomMargin}>
                <div className="flex items-stretch gap-4 mb-6">
                  <div className="w-[3px] bg-orange-600 rounded-full" />
                  <div>
                    <h2 className="text-xl font-black text-white">{label}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((r) => <StuffCard key={r.id} review={r} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StuffCard({ review: r }: { review: { id: string; slug: string; title: string; product_name: string; category: string; rating: number | null; excerpt: string | null; image_url: string | null; published_at: string | null } }) {
  const cat = getCategoryBySlug(r.category)
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
    >
      {r.image_url ? (
        <div className="relative w-full h-44 bg-gray-800 shrink-0">
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className="w-full h-44 bg-gray-800/50 flex items-center justify-center shrink-0">
          <span className="text-4xl">{cat?.icon ?? '📦'}</span>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
            {r.product_name}
          </span>
          <RatingScore rating={r.rating ?? 0} />
        </div>
        <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
          {r.title}
        </h3>
        {r.excerpt && (
          <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
        )}
        <div className="mt-4 pt-4">
          <span className="text-xs text-orange-500 font-medium">Read full review</span>
        </div>
      </div>
    </Link>
  )
}
