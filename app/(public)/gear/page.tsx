import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import { MerchPanel } from './_components/MerchPanel'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import BenchStrip from '@/components/BenchStrip'
import { getSeasonalOccasions } from '@/lib/gift-occasions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Boss Daddy's Gear — Field-Tested Picks",
  description: 'Every product Boss Daddy has personally bought, tested, and stands behind — sorted by rating. The only list where every pick is earned, not sponsored. Plus branded goods, made by a real dad.',
  openGraph: {
    title: "Boss Daddy's Gear — Boss Daddy Life",
    description: 'Every product personally bought, tested, and rated. Field-tested by a real dad. And, soon, made by one.',
    images: [{ url: '/api/og?title=Boss+Daddy+Gear&type=review', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: "Boss Daddy's Gear — Boss Daddy Life" },
  alternates: { canonical: '/gear' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function GearPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  // ── Queries (all parallelized) ──────────────────────────────────────────────
  const seasonalOccasions = getSeasonalOccasions()
  const seasonalValues = seasonalOccasions.map((o) => o.value)

  // Apply category filter at DB level (before limit) — JS post-filter would
  // miss in-category reviews ranked below position 120 globally.
  let reviewsQuery = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .gte('rating', 8)
    .order('rating', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(120)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (category) reviewsQuery = reviewsQuery.eq('category', category as any)

  const [
    { data: reviews },
    { data: allApproved },
    { data: giftPickLists },
    { data: featuredPickRows },
  ] = await Promise.all([
    reviewsQuery,
    supabase
      .from('reviews')
      .select('category')
      .eq('status', 'approved')
      .eq('is_visible', true),
    // Gift guide pick lists for seasonal occasions
    supabase
      .from('pick_lists')
      .select('id, slug, title, hero_image_url, occasion')
      .eq('pick_type', 'gift_guide')
      .eq('is_visible', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in('occasion', seasonalValues as any),
    // Featured collection (most recently published general/best_of)
    supabase
      .from('pick_lists')
      .select('id, slug, title, description, hero_image_url')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in('pick_type', ['general', 'best_of'] as any)
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(1),
  ])

  const topPicks = reviews ?? []
  const cat = category ? getCategoryBySlug(category) : null
  const featuredPick = featuredPickRows?.[0] ?? null

  // Fetch featured pick items (sequential — depends on featuredPick)
  let featuredItems: {
    position: number
    blurb: string | null
    reviews: { slug: string; title: string; product_name: string; rating: number; image_url: string | null } | null
  }[] = []
  if (featuredPick) {
    const { data } = await supabase
      .from('pick_list_items')
      .select('position, blurb, reviews(slug, title, product_name, rating, image_url)')
      .eq('pick_list_id', featuredPick.id)
      .order('position')
      .limit(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featuredItems = (data ?? []) as any
  }

  // Build gift guide map for fast lookup: occasion value → pick_list
  const giftPickMap = new Map(
    (giftPickLists ?? []).map((p) => [p.occasion, p])
  )

  // Stats
  const categoryCount  = new Set((allApproved ?? []).map((r) => r.category)).size
  const bossPicks      = topPicks.filter((r) => (r.rating ?? 0) >= 9).length
  const topPick        = !category ? (topPicks.find((r) => r.image_url) ?? null) : null

  // Per-category counts for the Shop by Category section (from full topPicks)
  const countByCategory = new Map<string, number>()
  for (const r of topPicks) {
    countByCategory.set(r.category, (countByCategory.get(r.category) ?? 0) + 1)
  }

  // Tier groups
  const tens   = topPicks.filter((r) => (r.rating ?? 0) === 10)
  const nines  = topPicks.filter((r) => (r.rating ?? 0) >= 9 && (r.rating ?? 0) < 10)
  const eights = topPicks.filter((r) => (r.rating ?? 0) >= 8 && (r.rating ?? 0) < 9)
  const tiers  = [
    { label: '🏆 Perfect Score', sub: 'Flawless. Nothing I tested came close.',                        items: tens },
    { label: '⭐ Boss Picks',     sub: 'Earned it. These are the ones I recommend without hesitation.', items: nines },
    { label: '👍 Solid Gear',    sub: 'Good enough that I kept them. Not perfect, but worth it.',       items: eights },
  ].filter((t) => t.items.length > 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Daddy Tested, Boss Approved</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight flex items-center gap-3">
          {cat && <CategoryIcon slug={cat.slug} className="w-10 h-10 text-orange-500" />}{cat ? `${cat.label} Gear` : "Boss Daddy's Gear"}
        </h1>
        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl">
          I know we shouldn&apos;t pray for stuff, but here&apos;s a list of some really cool stuff.
        </p>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {topPicks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-4 border-b border-gray-800/40 text-sm text-gray-500">
          <Link href="/reviews" className="hover:text-gray-300 transition-colors">
            <span className="text-white font-bold tabular-nums">{topPicks.length}</span> {topPicks.length === 1 ? 'pick' : 'picks'} rated 8+
          </Link>
          {!category && (
            <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <Link href="/reviews" className="hover:text-gray-300 transition-colors">
                <span className="text-white font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}
              </Link>
            </>
          )}
          {!category && bossPicks > 0 && (
            <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <a href="#boss-picks" className="hover:text-gray-300 transition-colors">
                <span className="text-orange-400 font-bold tabular-nums">{bossPicks}</span> Boss {bossPicks === 1 ? 'Pick' : 'Picks'} (9+)
              </a>
            </>
          )}
          {!category && tens.length > 0 && (
            <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <a href="#perfect-score" className="hover:text-gray-300 transition-colors">
                <span className="text-white font-bold tabular-nums">{tens.length}</span> perfect {tens.length === 1 ? 'score' : 'scores'} (10/10)
              </a>
            </>
          )}
        </div>
      )}

      {/* ── Category filter ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/gear"
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
            !category
              ? 'bg-orange-600 text-white shadow-md shadow-black/30 hover:bg-orange-500'
              : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20'
          }`}
        >
          All Gear
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/gear?category=${c.slug}`}
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              category === c.slug
                ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20'
            }`}
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-orange-500" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      {/* ── #1 Pick hero (unfiltered only) ──────────────────────────────────── */}
      {!category && topPick && (
        <div className="mb-16">
          <FeaturedReviewCard review={{ ...topPick, rating: topPick.rating ?? 0 }} label="Boss's #1 Pick" />
        </div>
      )}

      {/* ── Unfiltered-only discovery sections ──────────────────────────────── */}
      {!category && (
        <>
          {/* ── Shop by Occasion ──────────────────────────────────────────── */}
          <section className="mb-16">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-stretch gap-4">
                <div className="w-[3px] bg-orange-600 rounded-full" />
                <div>
                  <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">Gift Guides</p>
                  <h2 className="text-2xl font-black text-white leading-tight">Shop by Occasion</h2>
                </div>
              </div>
              <Link
                href="/gifts"
                className="hidden sm:inline-flex text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
              >
                All gift guides →
              </Link>
            </div>

            {/* Mobile: horizontal scroll / Desktop: 3-col grid */}
            <div className="sm:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
              {seasonalOccasions.map((occ) => {
                const pick = giftPickMap.get(occ.value)
                return (
                  <Link
                    key={occ.slug}
                    href={`/gifts/${occ.slug}`}
                    className="shrink-0 w-40 rounded-2xl overflow-hidden bg-gray-900 shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all"
                  >
                    <div className="relative w-full h-24 bg-gray-800">
                      {pick?.hero_image_url ? (
                        <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover" sizes="160px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">{occ.emoji}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <p className="absolute bottom-2 left-3 right-3 text-white text-xs font-black leading-tight">{occ.label}</p>
                    </div>
                    <p className="px-3 py-2 text-xs text-gray-400 line-clamp-2 leading-relaxed">{occ.shortBlurb}</p>
                  </Link>
                )
              })}
            </div>

            <div className="hidden sm:grid grid-cols-3 gap-4">
              {seasonalOccasions.map((occ) => {
                const pick = giftPickMap.get(occ.value)
                return (
                  <Link
                    key={occ.slug}
                    href={`/gifts/${occ.slug}`}
                    className="group relative rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all"
                  >
                    <div className="relative w-full h-36 bg-gray-800">
                      {pick?.hero_image_url ? (
                        <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 33vw, 320px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-4xl">{occ.emoji}</div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-black text-sm leading-tight mb-0.5">{occ.label}</p>
                      <p className="text-gray-300 text-xs line-clamp-1">{occ.shortBlurb}</p>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 sm:hidden text-right">
              <Link href="/gifts" className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                All gift guides →
              </Link>
            </div>
          </section>

          {/* ── Featured Collection ────────────────────────────────────────── */}
          {featuredPick && (
            <section className="mb-16">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-stretch gap-4">
                  <div className="w-[3px] bg-orange-600 rounded-full" />
                  <div>
                    <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">Curated Pick</p>
                    <h2 className="text-2xl font-black text-white leading-tight">Featured Collection</h2>
                  </div>
                </div>
                <Link
                  href="/picks"
                  className="hidden sm:inline-flex text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
                >
                  All collections →
                </Link>
              </div>

              <Link href={`/picks/${featuredPick.slug}`} className="group block bg-gray-900 rounded-2xl overflow-hidden shadow-xl shadow-black/50 hover:shadow-black/70 transition-all">
                <div className="flex flex-col sm:flex-row">
                  {/* Hero image */}
                  <div className="relative w-full sm:w-72 h-48 sm:h-auto sm:min-h-[220px] shrink-0 bg-gray-800">
                    {featuredPick.hero_image_url ? (
                      <Image
                        src={featuredPick.hero_image_url}
                        alt={featuredPick.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, 288px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">⭐</div>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white leading-snug mb-2 group-hover:text-orange-400 transition-colors">
                        {featuredPick.title}
                      </h3>
                      {featuredPick.description && (
                        <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-4">
                          {featuredPick.description}
                        </p>
                      )}
                      {/* 3 preview items */}
                      {featuredItems.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {featuredItems.map((item, i) => {
                            const r = item.reviews
                            if (!r) return null
                            return (
                              <div key={i} className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2.5 py-1.5">
                                {r.image_url && (
                                  <div className="relative w-6 h-6 rounded overflow-hidden shrink-0">
                                    <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="24px" />
                                  </div>
                                )}
                                <span className="text-xs text-gray-300 font-medium truncate max-w-[120px]">{r.product_name}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <span className="text-sm text-orange-500 font-semibold group-hover:text-orange-400 transition-colors">
                        See full list →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 sm:hidden text-right">
                <Link href="/picks" className="text-xs text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                  All collections →
                </Link>
              </div>
            </section>
          )}

          {/* ── Shop by Category ──────────────────────────────────────────── */}
          <section className="mb-16">
            <div className="flex items-stretch gap-4 mb-6">
              <div className="w-[3px] bg-orange-600 rounded-full" />
              <div>
                <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">Browse</p>
                <h2 className="text-2xl font-black text-white leading-tight">Shop by Category</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((c) => {
                const count = countByCategory.get(c.slug) ?? 0
                return (
                  <Link
                    key={c.slug}
                    href={`/category/${c.slug}`}
                    className="group flex flex-col items-center justify-center text-center gap-2 bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 min-h-[120px] shadow-md shadow-black/30 transition-all"
                  >
                    <CategoryIcon slug={c.slug} className="w-7 h-7 text-orange-500" />
                    <span className="text-sm font-bold text-white leading-tight group-hover:text-orange-400 transition-colors">
                      {c.shortLabel}
                    </span>
                    <span className="text-xs text-gray-600">
                      {count > 0 ? `${count} pick${count !== 1 ? 's' : ''}` : 'Coming soon'}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── Boss Daddy Merch ──────────────────────────────────────────── */}
          <MerchPanel />
        </>
      )}

      {/* ── Tiers / filtered grid ────────────────────────────────────────────── */}
      {!topPicks.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">Nothing here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Reviews are being added.</p>
        </div>
      ) : category ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((r) => <GearCard key={r.id} review={r} />)}
        </div>
      ) : (
        <div>
          {tiers.map(({ label, sub, items }, i) => {
            const isLast = i === tiers.length - 1
            const isPerfect = label.includes('Perfect Score')
            const bottomMargin = isLast ? '' : isPerfect ? 'mb-24' : 'mb-16'
            return (
              <section
                key={label}
                id={isPerfect ? 'perfect-score' : label.includes('Boss Picks') ? 'boss-picks' : undefined}
                className={bottomMargin}
              >
                <div className="flex items-stretch gap-4 mb-6">
                  <div className="w-[3px] bg-orange-600 rounded-full" />
                  <div>
                    <h2 className="text-xl font-black text-white">{label}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {items.map((r) => <GearCard key={r.id} review={r} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* ── Bench strip ─────────────────────────────────────────────────────── */}
      <div className="mt-16">
        <p className="text-xs text-gray-500 mb-3">More gear is on the way. Vote on what gets tested next.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <div className="mt-12 text-center">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-orange-400 transition-colors font-medium"
        >
          Browse the full review archive →
        </Link>
      </div>

    </div>
  )
}

function GearCard({ review: r }: { review: { id: string; slug: string; title: string; product_name: string; category: string; rating: number | null; excerpt: string | null; image_url: string | null; published_at: string | null } }) {
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
          {cat ? <CategoryIcon slug={cat.slug} className="w-8 h-8 text-orange-500" /> : <span className="text-4xl">📦</span>}
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
