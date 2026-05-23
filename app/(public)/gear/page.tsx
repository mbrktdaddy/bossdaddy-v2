import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { getBadgesByProductSlug, type ProductBadge } from '@/lib/collection-listings'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import BadgesForProduct from '@/components/collections/BadgesForProduct'
import { MerchPanel } from './_components/MerchPanel'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import BenchStrip from '@/components/BenchStrip'
import { getSeasonalOccasions } from '@/lib/gift-occasions'
import OccasionIcon from '@/components/OccasionIcon'
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

  const seasonalOccasions = getSeasonalOccasions()
  const seasonalValues = seasonalOccasions.map((o) => o.value)

  // Apply category filter at DB level (before limit) — JS post-filter would
  // miss in-category reviews ranked below position 120 globally.
  let reviewsQuery = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, is_top_pick')
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
    supabase
      .from('collections')
      .select('id, slug, title, hero_image_url, occasion')
      .eq('collection_type', 'gift_guide')
      .eq('is_visible', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in('occasion', seasonalValues as any),
    supabase
      .from('collections')
      .select('id, slug, title, description, hero_image_url')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .in('collection_type', ['general', 'best_of'] as any)
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(1),
  ])

  const rawTopPicks = (reviews ?? []) as GearReview[]
  // Batch-fetch collection badges for every visible product in one query so
  // GearCard can render chips per card without N+1 round-trips.
  const slugsForBadges = rawTopPicks.map((r) => r.product_slug).filter((s): s is string => Boolean(s))
  const badgeMap = await getBadgesByProductSlug(supabase, slugsForBadges)
  const topPicks: GearReview[] = rawTopPicks.map((r) => ({
    ...r,
    badges: r.product_slug ? badgeMap.get(r.product_slug) ?? [] : [],
  }))
  const cat = category ? getCategoryBySlug(category) : null
  const featuredPick = featuredPickRows?.[0] ?? null

  let featuredItems: {
    position: number
    blurb: string | null
    reviews: { slug: string; title: string; product_name: string; rating: number; image_url: string | null } | null
  }[] = []
  if (featuredPick) {
    const { data } = await supabase
      .from('collection_items')
      .select('position, blurb, reviews(slug, title, product_name, rating, image_url)')
      .eq('collection_id', featuredPick.id)
      .order('position')
      .limit(3)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featuredItems = (data ?? []) as any
  }

  const giftPickMap = new Map(
    (giftPickLists ?? []).map((p) => [p.occasion, p])
  )

  const categoryCount = new Set((allApproved ?? []).map((r) => r.category)).size
  const bossPicks     = topPicks.filter((r) => (r.rating ?? 0) >= 9).length
  // #1 Pick: admin-flagged all-time champion wins. Fall back to the prior
  // algorithmic pick (first high-rated review with an image) so the slot
  // never goes empty if nothing has been flagged.
  const topPick = !category
    ? (topPicks.find((r) => r.is_top_pick && r.image_url)
       ?? topPicks.find((r) => r.image_url)
       ?? null)
    : null

  const countByCategory = new Map<string, number>()
  for (const r of topPicks) {
    countByCategory.set(r.category, (countByCategory.get(r.category) ?? 0) + 1)
  }

  const tens   = topPicks.filter((r) => (r.rating ?? 0) === 10)
  const nines  = topPicks.filter((r) => (r.rating ?? 0) >= 9 && (r.rating ?? 0) < 10)
  const eights = topPicks.filter((r) => (r.rating ?? 0) >= 8 && (r.rating ?? 0) < 9)

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">

      {/* ── Header — tick-line eyebrow pattern (matches homepage) ─────────── */}
      <div className="mb-8">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Daddy Tested, Boss Approved</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-prose tracking-tight flex items-center gap-3">
          {cat && <CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text" />}
          <span>{cat ? `${cat.label} Gear` : "Boss Daddy's Gear"}</span>
        </h1>
        <p className="text-prose-muted text-base md:text-lg leading-relaxed max-w-2xl">
          I know we shouldn&apos;t pray for stuff, but here&apos;s a list of some really cool stuff.
        </p>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      {topPicks.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 pb-4 border-b border-soft/40 text-sm text-prose-faint">
          <Link href="/reviews" className="hover:text-prose transition-colors">
            <span className="text-prose font-bold tabular-nums">{topPicks.length}</span> {topPicks.length === 1 ? 'pick' : 'picks'} rated 8+
          </Link>
          {!category && (
            <>
              <span className="text-prose-faint hidden sm:block">·</span>
              <Link href="/reviews" className="hover:text-prose transition-colors">
                <span className="text-prose font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}
              </Link>
            </>
          )}
          {!category && bossPicks > 0 && (
            <>
              <span className="text-prose-faint hidden sm:block">·</span>
              <a href="#boss-picks" className="hover:text-prose transition-colors">
                <span className="text-accent-text-soft font-bold tabular-nums">{bossPicks}</span> Boss {bossPicks === 1 ? 'Pick' : 'Picks'} (9+)
              </a>
            </>
          )}
          {!category && tens.length > 0 && (
            <>
              <span className="text-prose-faint hidden sm:block">·</span>
              <a href="#perfect-score" className="hover:text-prose transition-colors">
                <span className="text-prose font-bold tabular-nums">{tens.length}</span> perfect {tens.length === 1 ? 'score' : 'scores'} (10/10)
              </a>
            </>
          )}
        </div>
      )}

      {/* ── Category filter pills ──────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/gear"
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
            !category
              ? 'bg-accent text-white shadow-md shadow-stone-900/[0.05] hover:bg-accent-hover'
              : 'bg-surface text-prose-muted hover:bg-surface-raised hover:text-prose shadow-sm shadow-stone-900/[0.04]'
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
                ? 'bg-accent text-white shadow-md shadow-stone-900/[0.05]'
                : 'bg-surface text-prose-muted hover:bg-surface-raised hover:text-prose shadow-sm shadow-stone-900/[0.04]'
            }`}
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
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
          {/* ── Shop by Occasion — tick-line header + tactile cards ────────── */}
          <section className="mb-16">
            <div className="flex items-end justify-between mb-6">
              <div>
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Gift Guides</p>
                <h2 className="text-2xl font-black text-prose leading-tight">Shop by Occasion</h2>
              </div>
              <Link
                href="/gifts"
                className="hidden sm:inline-flex text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold shrink-0"
              >
                All gift guides →
              </Link>
            </div>

            {/* Mobile: horizontal scroll */}
            <div className="sm:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
              {seasonalOccasions.map((occ) => {
                const pick = giftPickMap.get(occ.value)
                return (
                  <Link
                    key={occ.slug}
                    href={`/gifts/${occ.slug}`}
                    className="shrink-0 w-40 rounded-xl overflow-hidden bg-gradient-to-br from-surface to-surface/60 border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-lg shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-xl hover:shadow-stone-900/[0.10] hover:-translate-y-1 transition-all"
                  >
                    <div className="relative w-full h-24 bg-surface-raised">
                      {pick?.hero_image_url ? (
                        <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover" sizes="160px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-9 h-9 text-accent-text/60" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent" />
                      <p className="absolute bottom-2 left-3 right-3 text-white text-xs font-black leading-tight">{occ.label}</p>
                    </div>
                    <p className="px-3 py-2 text-xs text-prose-muted line-clamp-2 leading-relaxed">{occ.shortBlurb}</p>
                  </Link>
                )
              })}
            </div>

            {/* Desktop: 3-col grid */}
            <div className="hidden sm:grid grid-cols-3 gap-4">
              {seasonalOccasions.map((occ) => {
                const pick = giftPickMap.get(occ.value)
                return (
                  <Link
                    key={occ.slug}
                    href={`/gifts/${occ.slug}`}
                    className="group relative rounded-xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-lg shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-xl hover:shadow-stone-900/[0.10] hover:-translate-y-1 transition-all"
                  >
                    <div className="relative w-full h-36 bg-surface-raised">
                      {pick?.hero_image_url ? (
                        <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 33vw, 320px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-12 h-12 text-accent-text/60" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 via-stone-900/20 to-transparent" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-black text-sm leading-tight mb-0.5">{occ.label}</p>
                      <p className="text-stone-200 text-xs line-clamp-1">{occ.shortBlurb}</p>
                    </div>
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 sm:hidden text-right">
              <Link href="/gifts" className="text-xs text-accent-text-soft hover:text-accent font-semibold transition-colors">
                All gift guides →
              </Link>
            </div>
          </section>

          {/* ── Featured Collection — tick-line header + tactile card ──────── */}
          {featuredPick && (
            <section className="mb-16">
              <div className="flex items-end justify-between mb-6">
                <div>
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Curated Pick</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">Featured Collection</h2>
                </div>
                <Link
                  href="/picks"
                  className="hidden sm:inline-flex text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold shrink-0"
                >
                  All collections →
                </Link>
              </div>

              <Link
                href={`/picks/${featuredPick.slug}`}
                className="group block bg-gradient-to-br from-surface to-surface/60 rounded-xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-xl shadow-stone-900/[0.08] hover:border-accent-border/40 hover:shadow-stone-900/[0.10] hover:-translate-y-1 transition-all"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative w-full sm:w-72 h-48 sm:h-auto sm:min-h-[220px] shrink-0 bg-surface-raised">
                    {featuredPick.hero_image_url ? (
                      <Image
                        src={featuredPick.hero_image_url}
                        alt={featuredPick.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, 288px"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-raised/40 to-surface/60">
                        <svg className="w-12 h-12 text-accent-text/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-black text-prose leading-snug mb-2 group-hover:text-accent-text-soft transition-colors">
                        {featuredPick.title}
                      </h3>
                      {featuredPick.description && (
                        <p className="text-sm text-prose-muted leading-relaxed line-clamp-2 mb-4">
                          {featuredPick.description}
                        </p>
                      )}
                      {featuredItems.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {featuredItems.map((item, i) => {
                            const r = item.reviews
                            if (!r) return null
                            return (
                              <div key={i} className="flex items-center gap-1.5 bg-surface-raised rounded-lg px-2.5 py-1.5">
                                {r.image_url && (
                                  <div className="relative w-6 h-6 rounded overflow-hidden shrink-0">
                                    <Image src={r.image_url} alt={r.product_name} fill className="object-cover" sizes="24px" />
                                  </div>
                                )}
                                <span className="text-xs text-prose-muted font-medium truncate max-w-[120px]">{r.product_name}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="mt-4">
                      <span className="text-sm text-accent-text font-semibold group-hover:text-accent-text-soft transition-colors">
                        See full list →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 sm:hidden text-right">
                <Link href="/picks" className="text-xs text-accent-text-soft hover:text-accent font-semibold transition-colors">
                  All collections →
                </Link>
              </div>
            </section>
          )}

          {/* ── Shop by Category — warm-tint surface + unified opener ──────── */}
          <section className="relative mb-16">
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-accent/[0.04] to-transparent"
            />
            <div className="relative">
              <div className="mb-6">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Browse</p>
                <h2 className="text-2xl font-black text-prose leading-tight">Shop by Category</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map((c) => {
                  const count = countByCategory.get(c.slug) ?? 0
                  return (
                    <Link
                      key={c.slug}
                      href={`/category/${c.slug}`}
                      className="group flex flex-col items-center justify-center text-center gap-2 bg-gradient-to-br from-surface to-surface/60 hover:bg-surface-raised rounded-xl p-4 min-h-[120px] border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-md shadow-stone-900/[0.05] hover:border-accent-border/40 hover:shadow-lg hover:shadow-stone-900/[0.06] hover:-translate-y-1 transition-all"
                    >
                      <CategoryIcon slug={c.slug} className="w-7 h-7 text-accent-text" />
                      <span className="text-sm font-bold text-prose leading-tight group-hover:text-accent-text-soft transition-colors">
                        {c.shortLabel}
                      </span>
                      <span className="text-xs text-prose-faint">
                        {count > 0 ? `${count} pick${count !== 1 ? 's' : ''}` : 'Coming soon'}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── Boss Daddy Merch ──────────────────────────────────────────── */}
          <MerchPanel />
        </>
      )}

      {/* ── Tiers / filtered grid ────────────────────────────────────────────
          Three distinct geometries for the three rating tiers — a visual
          hierarchy that mirrors the rating hierarchy:
            10:  asymmetric magazine 1+2 (most editorial, top of pyramid)
            9+:  standard 3-col card grid (workhorse middle)
            8+:  compact editorial rows (browse-and-scan base) */}
      {!topPicks.length ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04]">
          <p className="text-prose-faint text-lg font-semibold">Nothing here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Reviews are being added.</p>
        </div>
      ) : category ? (
        // Filtered view: simple 3-col grid (no tier separation when filtered)
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((r) => <GearCard key={r.id} review={r} />)}
        </div>
      ) : (
        <div>
          {/* ── Perfect Score — asymmetric magazine grid + radial glow ──── */}
          {tens.length > 0 && (
            <section id="perfect-score" className="relative mb-24">
              <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(204,85,0,0.10), transparent 60%)',
                }}
              />
              <div className="relative">
                <div className="mb-6">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Top Tier</p>
                  <h2 className="text-xl font-black text-prose">Perfect Score</h2>
                  <p className="text-xs text-prose-faint mt-0.5">Flawless. Nothing I tested came close.</p>
                </div>
                {tens.length === 1 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {tens.map((r) => <GearCard key={r.id} review={r} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
                    {tens.slice(0, 3).map((r, i) => (
                      <GearCard key={r.id} review={r} isHero={i === 0} />
                    ))}
                  </div>
                )}
                {tens.length > 3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                    {tens.slice(3).map((r) => <GearCard key={r.id} review={r} />)}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Boss Picks — standard 3-col card grid ──────────────────── */}
          {nines.length > 0 && (
            <section id="boss-picks" className="mb-16">
              <div className="mb-6">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Boss Approved</p>
                <h2 className="text-xl font-black text-prose">Boss Picks</h2>
                <p className="text-xs text-prose-faint mt-0.5">Earned it. These are the ones I recommend without hesitation.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {nines.map((r) => <GearCard key={r.id} review={r} />)}
              </div>
            </section>
          )}

          {/* ── Solid Gear — compact editorial rows ────────────────────── */}
          {eights.length > 0 && (
            <section className="mb-16">
              <div className="mb-6">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Worth It</p>
                <h2 className="text-xl font-black text-prose">Solid Gear</h2>
                <p className="text-xs text-prose-faint mt-0.5">Good enough that I kept them. Not perfect, but worth it.</p>
              </div>
              <div className="divide-y divide-soft">
                {eights.map((r) => <GearRow key={r.id} review={r} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Bench strip ─────────────────────────────────────────────────────── */}
      <div className="mt-16">
        <p className="text-xs text-prose-faint mb-3">More gear is on the way. Vote on what gets tested next.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      {/* ── Footer CTA ──────────────────────────────────────────────────────── */}
      <div className="mt-12 text-center">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-2 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
        >
          Browse the full review archive →
        </Link>
      </div>

    </div>
  )
}

type GearReview = {
  id: string
  slug: string
  title: string
  product_name: string
  category: string
  rating: number | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  product_slug: string | null
  is_top_pick?: boolean
  // Pre-resolved collection badges. Batch-fetched once at the page level.
  badges?: ProductBadge[]
}

function GearCard({
  review: r,
  isHero = false,
  eyebrow,
}: {
  review: GearReview
  isHero?: boolean
  eyebrow?: string | null
}) {
  const cat = getCategoryBySlug(r.category)
  const resolvedEyebrow = eyebrow === null ? null : eyebrow ?? cat?.label ?? null
  const showCategoryIcon = eyebrow === undefined && Boolean(cat)
  // Overlay-link pattern: article wrapper is non-clickable; title <Link> uses
  // after:absolute after:inset-0 to make the whole card clickable as a link.
  // Badges sit above the overlay via relative z-10, so their own links work.
  // Avoids invalid <a>-inside-<a> HTML that nested cards had previously.
  return (
    <article
      className={`group relative flex flex-col bg-gradient-to-br from-surface to-surface/60 rounded-xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-lg shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-xl hover:shadow-stone-900/[0.10] hover:-translate-y-1 transition-all duration-200 ${
        isHero ? 'lg:col-span-2 lg:row-span-2' : ''
      }`}
    >
      {r.image_url ? (
        <div className={`relative w-full bg-surface-raised shrink-0 ${
          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
        }`}>
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={
              isHero
                ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 680px'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
          />
        </div>
      ) : (
        <div className={`w-full bg-gradient-to-br from-surface-raised/40 to-surface/40 flex items-center justify-center shrink-0 ${
          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
        }`}>
          {cat && <CategoryIcon slug={cat.slug} className={isHero ? 'w-12 h-12 text-accent-text/40' : 'w-8 h-8 text-accent-text/40'} />}
        </div>
      )}
      <div className={`flex flex-col flex-1 ${isHero ? 'p-6 lg:p-7' : 'p-5'}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            {resolvedEyebrow && (
              <>
                {showCategoryIcon && cat && (
                  <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                )}
                <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                  {resolvedEyebrow}
                </span>
              </>
            )}
          </div>
          <RatingScore rating={r.rating ?? 0} />
        </div>
        <h3 className={`leading-snug flex-1 ${
          isHero ? 'text-xl md:text-2xl font-black text-prose' : 'text-base font-semibold'
        }`}>
          <Link
            href={`/reviews/${r.slug}`}
            className="after:absolute after:inset-0 group-hover:text-accent-text-soft transition-colors"
          >
            {r.title}
          </Link>
        </h3>
        {r.excerpt && (
          <p className={`text-prose-faint mt-2 ${
            isHero ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2'
          }`}>
            {r.excerpt}
          </p>
        )}
        {r.badges && r.badges.length > 0 && (
          <div className="relative z-10">
            <BadgesForProduct badges={r.badges} max={isHero ? 3 : 2} compact={!isHero} />
          </div>
        )}
        <div className="mt-4 pt-4">
          <span className="text-xs text-accent-text font-medium">Read full review</span>
        </div>
      </div>
    </article>
  )
}

// Compact editorial row treatment for the lowest tier — mirrors the
// homepage Latest Guides geometry but flipped (image left, title right)
// so the two surfaces don't read as identical.
function GearRow({ review: r }: { review: GearReview }) {
  const cat = getCategoryBySlug(r.category)
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
          <div className="w-full h-full bg-gradient-to-br from-surface-raised/50 to-surface/40 flex items-center justify-center">
            {cat && <CategoryIcon slug={cat.slug} className="w-6 h-6 text-accent-text/40" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {cat && <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text" />}
          <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {cat?.shortLabel ?? r.category}
          </span>
        </div>
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
