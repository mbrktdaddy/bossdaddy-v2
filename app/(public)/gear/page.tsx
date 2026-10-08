import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES } from '@/lib/categories'
import { getBadgesByProductSlug } from '@/lib/collection-listings'
import { getLiveRadar } from '@/lib/products/radar'
import { LABELS } from '@/lib/labels'
import CategoryIcon from '@/components/CategoryIcon'
import { MerchStrip } from '@/components/MerchStrip'
import { GearRow, type GearReview } from './_components/GearCards'
import ReviewCard from '@/components/ReviewCard'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import BenchStrip from '@/components/BenchStrip'
import AskTheBoss from '@/components/AskTheBoss'
import SectionHeader from '@/components/SectionHeader'
import PageHeader from '@/components/PageHeader'
import { RadarLane } from '@/components/radar/RadarLane'
import { EmptyState } from '@/components/ui/EmptyState'
import { getSeasonalOccasions } from '@/lib/gift-occasions'
import OccasionIcon from '@/components/OccasionIcon'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import type { Metadata } from 'next'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { StarIcon } from '@/components/icons'
import VaultCard from '@/components/VaultCard'
import { getVaultTab } from '@/lib/vault'

export const revalidate = 3600
// getSeasonalOccasions() and the Radar's "released by now" filter read the
// current date, which otherwise nudges Next into rendering this hub
// dynamically. There's no request-varying input here (no cookies/searchParams —
// verified with dynamic='error'), so pin it static; the seasonal gift-guide set
// and newly released Radar items arrive on the hourly ISR revalidate (product
// edits purge it sooner, via revalidateProductPaths).
export const dynamic = 'force-static'

// Copy rule (brand-guide §1.9): this hub mixes reviews with On the Radar
// picks that haven't been tested, so no page-level "tested" or "bought with my
// own money" claim. Testing claims belong to the reviews themselves.
export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  title: { absolute: "Boss Daddy's Gear — Rated Picks and What's on the Radar" },
  description: "Gear Boss Daddy rated 8 or higher, what's on his test bench, and new gear that caught his eye. Every review is earned. Every pick is independently chosen.",
  openGraph: {
    ...OG_SITE,
    title: "Boss Daddy's Gear — Boss Daddy Life",
    description: "Rated gear, what's on the test bench, and new gear that caught a dad's eye.",
    images: [{ url: ogImageUrl({ title: 'Boss Daddy Gear', type: 'review' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE, title: "Boss Daddy's Gear — Boss Daddy Life" },
  alternates: { canonical: '/gear' },
}

// Static gear index (audit H3): no searchParams, cookie-free anon reads.
// Category filtering lives on the path-based /gear/category/[slug] routes the
// pills link to, so this hub prerenders as static HTML.
//
// Layout is a trust ladder (docs/gear-radar-plan.md): the tested lead (#1 Pick,
// Perfect Score), then On the Radar, then Boss Approved + Solid Gear, then the
// Bench. So the page tells the whole journey (Radar → Bench → Boss Approved);
// gift guides and the featured collection sit lower.
export default async function GearPage() {
  const supabase = createAnonClient()

  const seasonalOccasions = getSeasonalOccasions()
  const seasonalValues = seasonalOccasions.map((o) => o.value)

  const [
    { data: reviews },
    { data: giftPickLists },
    { data: featuredPickRows },
    { data: stackRows },
    radar,
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, is_top_pick')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .gte('rating', 8)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(120),
    supabase
      .from('collections')
      .select('id, slug, title, hero_image_url, occasion, collection_items(count)')
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
    // Kits (Phase I-3): stacks are a SHOPPING format, so they live here beside
    // the gift guides, not in a reading index. Same live rule as everywhere
    // else — visible AND published (is_visible alone would leak scheduled
    // ones) — plus the gift-guide rule that an empty collection is not live.
    supabase
      .from('collections')
      .select('id, slug, title, description, hero_image_url, collection_type, occasion, collection_items(count)')
      .eq('collection_type', 'stack')
      .eq('is_visible', true)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(3),
    // The newest 6 (plan: 6–9). Older ones age off here but stay in /gear/radar.
    getLiveRadar(supabase, { limit: 6 }),
  ])

  const rawTopPicks = (reviews ?? []) as GearReview[]
  // Batch-fetch collection badges for every visible product in one query so
  // ReviewCard can render chips per card without N+1 round-trips.
  const slugsForBadges = rawTopPicks.map((r) => r.product_slug).filter((s): s is string => Boolean(s))
  const badgeMap = await getBadgesByProductSlug(supabase, slugsForBadges)
  const topPicks: GearReview[] = rawTopPicks.map((r) => ({
    ...r,
    badges: r.product_slug ? badgeMap.get(r.product_slug) ?? [] : [],
  }))
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
  // Only surface gift guides that actually have picks — an empty collection
  // routes to a "Coming Soon" dead-end, which we don't want in this slot.
  // The section auto-collapses to a slim link when nothing is live yet.
  const populatedOccasions = new Set(
    (giftPickLists ?? [])
      .filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ci = (p as any).collection_items
        const count = Array.isArray(ci) ? (ci[0]?.count ?? 0) : 0
        return count > 0
      })
      .map((p) => p.occasion)
  )
  const liveSeasonalOccasions = seasonalOccasions.filter((o) => populatedOccasions.has(o.value))

  // Self-suppresses at zero (a hub section, not a tab — empty means absent).
  const kits = (stackRows ?? []).filter((s) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ci = (s as any).collection_items
    return Array.isArray(ci) && (ci[0]?.count ?? 0) > 0
  })

  const bossApproved = topPicks.filter((r) => (r.rating ?? 0) >= 9).length
  // #1 Pick: admin-flagged all-time champion wins. Fall back to the prior
  // algorithmic pick (first high-rated review with an image) so the slot
  // never goes empty if nothing has been flagged.
  const topPick =
    topPicks.find((r) => r.is_top_pick && r.image_url)
    ?? topPicks.find((r) => r.image_url)
    ?? null

  const tens   = topPicks.filter((r) => (r.rating ?? 0) === 10)
  const nines  = topPicks.filter((r) => (r.rating ?? 0) >= 9 && (r.rating ?? 0) < 10)
  const eights = topPicks.filter((r) => (r.rating ?? 0) >= 8 && (r.rating ?? 0) < 9)

  return (
    <>
      <PageHeader
        eyebrow="Rated · Testing · Watching"
        title={LABELS.gear.full}
        deck="The gear I've rated 8 or higher, what's on the bench right now, and what's caught my eye. Every review is earned. Every pick is independently chosen."
      />
      <div className="max-w-6xl mx-auto px-6 py-12">

      {/* ── #1 Pick — the showcase leads the page (Cover Story pattern) ─────── */}
      {topPick && (
        <div className="mb-12">
          <FeaturedReviewCard review={{ ...topPick, rating: topPick.rating ?? 0 }} label="Boss's #1 Pick" />
        </div>
      )}

      {/* ── Category filter pills — link to static path-based category routes ── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/gear"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-accent text-white border border-accent transition-colors"
        >
          All Gear
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/gear/category/${c.slug}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors"
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      {/* ── Tier summary — quick jump to each rating band ─────────────────── */}
      {(tens.length > 0 || bossApproved > 0) && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-8 text-sm text-prose-faint">
          <Eyebrow as="span">Jump to</Eyebrow>
          {tens.length > 0 && (
            <a href="#perfect-score" className="hover:text-prose transition-colors">
              <span className="text-prose font-bold tabular-nums">{tens.length}</span> perfect {tens.length === 1 ? 'score' : 'scores'}
            </a>
          )}
          {tens.length > 0 && bossApproved > 0 && <span className="hidden sm:block">·</span>}
          {bossApproved > 0 && (
            <a href="#boss-approved" className="hover:text-prose transition-colors">
              <span className="text-accent-text-soft font-bold tabular-nums">{bossApproved}</span> Boss Approved
            </a>
          )}
        </div>
      )}

      {/* ── Tiers ────────────────────────────────────────────────────────────
          Three distinct geometries for the three rating tiers — a visual
          hierarchy that mirrors the rating hierarchy:
            10:  asymmetric magazine 1+2 (most editorial, top of pyramid)
            9+:  standard 3-col card grid (workhorse middle)
            8+:  compact editorial rows (browse-and-scan base)
          On the Radar sits between the tested lead and Boss Approved
          (operator's call, 2026-09-29). */}

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
            <SectionHeader
              label="Top Tier"
              heading="Perfect Score"
              sub="Flawless. Nothing I tested came close."
            />
            {tens.length === 1 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {tens.map((r) => <ReviewCard key={r.id} review={r} headingLevel="h3" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
                {tens.slice(0, 3).map((r, i) => (
                  <ReviewCard key={r.id} review={r} hero={i === 0} headingLevel="h3" />
                ))}
              </div>
            )}
            {tens.length > 3 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-5">
                {tens.slice(3).map((r) => <ReviewCard key={r.id} review={r} headingLevel="h3" />)}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── On the Radar — untested picks with a take + "Want me to test it?" ── */}
      <RadarLane
        items={radar}
        sub="New gear that caught my eye, and why. Want me to put one to the test? Say the word."
        emptyText="Nothing on the radar right now. When something new catches my eye, it lands here first."
        className="mb-16"
      />

      {/* ── Boss Approved — standard 3-col card grid ───────────────── */}
      {nines.length > 0 && (
        <section id="boss-approved" className="mb-16">
          <SectionHeader
            label="Earned It"
            heading="Boss Approved"
            sub="The ones I recommend without hesitation."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {nines.map((r) => <ReviewCard key={r.id} review={r} headingLevel="h3" />)}
          </div>
        </section>
      )}

      {/* ── Solid Gear — compact editorial rows ────────────────────── */}
      {eights.length > 0 && (
        <section className="mb-16">
          <SectionHeader
            label="Worth It"
            heading="Solid Gear"
            sub="Not perfect, but worth your money."
          />
          <div className="divide-y divide-soft">
            {eights.map((r) => <GearRow key={r.id} review={r} />)}
          </div>
        </section>
      )}

      {!topPicks.length && (
        <EmptyState title="Nothing has rated 8 or higher yet." body="Reviews are being added." />
      )}

      {/* ── Bench strip — the middle of the journey: being tested now ──────── */}
      <div className="mt-16">
        <p className="text-xs text-prose-faint mb-3">What I&apos;m testing now. Follow one and you&apos;ll get the review the day it&apos;s out.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      {/* Topic hint for the Boss's first turn. Not "field-tested": the hub now
          holds Radar picks too, and the hint shouldn't prime a testing claim. */}
      <AskTheBoss context="Boss Daddy's gear picks" className="mt-16 mb-16" />

      {/* ── Shop by Occasion ─────────────────────────────────────────── */}
      {liveSeasonalOccasions.length > 0 ? (
      <section className="mb-16">
        <SectionHeader
          label="Gift Guides"
          heading="Shop by Occasion"
          right={{ label: 'All gift guides', href: '/gifts' }}
        />

        {/* Mobile: horizontal scroll */}
        <div className="sm:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
          {liveSeasonalOccasions.map((occ) => {
            const pick = giftPickMap.get(occ.value)
            return (
              <Link
                key={occ.slug}
                href={`/gifts/${occ.slug}`}
                className="shrink-0 w-40 rounded-xl overflow-hidden bg-surface border border-soft hover:border-accent-border/40 hover:-translate-y-1 transition-all"
              >
                <div className="relative w-full h-24 bg-surface-raised">
                  {pick?.hero_image_url ? (
                    <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover" sizes="160px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-9 h-9 text-accent-text/60" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
                  <p className="absolute bottom-2 left-3 right-3 text-white text-xs font-black leading-tight">{occ.label}</p>
                </div>
                <p className="px-3 py-2 text-xs text-prose-muted line-clamp-2 leading-relaxed">{occ.shortBlurb}</p>
              </Link>
            )
          })}
        </div>

        {/* Desktop: 3-col grid */}
        <div className="hidden sm:grid grid-cols-3 gap-4">
          {liveSeasonalOccasions.map((occ) => {
            const pick = giftPickMap.get(occ.value)
            return (
              <Link
                key={occ.slug}
                href={`/gifts/${occ.slug}`}
                className="group relative rounded-xl overflow-hidden border border-soft hover:border-accent-border/40 hover:-translate-y-1 transition-all"
              >
                <div className="relative w-full h-36 bg-surface-raised">
                  {pick?.hero_image_url ? (
                    <Image src={pick.hero_image_url} alt={occ.label} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 33vw, 320px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-12 h-12 text-accent-text/60" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 via-zinc-900/20 to-transparent" />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-black text-sm leading-tight mb-0.5">{occ.label}</p>
                  <p className="text-zinc-200 text-xs line-clamp-1">{occ.shortBlurb}</p>
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
      ) : (
        /* No live gift guides yet — collapse to a single slim entry point
           instead of a grid of "Coming Soon" dead-ends. Self-heals into the
           full grid above once any seasonal guide gets its first pick. */
        <Link
          href="/gifts"
          className="group mb-16 flex items-center justify-between gap-4 rounded-xl border border-soft bg-surface px-5 py-4 hover:border-accent-border/40 hover:bg-surface-raised transition-colors"
        >
          <div>
            <Eyebrow className="mb-1">Gift Guides</Eyebrow>
            <p className="text-sm font-bold text-prose">Hand-picked gift guides for every occasion</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-accent-text-soft group-hover:text-accent transition-colors">Explore →</span>
        </Link>
      )}

      {/* ── Kits — stacks, the kit for the job (Phase I-3) ─────────────── */}
      {kits.length > 0 && (
        <section className="mb-16">
          <SectionHeader
            label={LABELS.stacks.kits}
            heading="Built for the job"
            sub="Every piece earned its spot — the newborn-night setup, the weekend cookout, the first toolbox."
            right={{ label: `All ${LABELS.stacks.short.toLowerCase()}`, href: '/stacks' }}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kits.map((k) => (
              <VaultCard key={k.id} col={k} cta={getVaultTab('stacks').cardCta} />
            ))}
          </div>
        </section>
      )}

      {/* ── Featured Collection ──────────────────────────────────────── */}
      {featuredPick && (
        <section className="mb-16">
          <SectionHeader
            label="Curated Pick"
            heading="Featured Collection"
            right={{ label: 'All collections', href: '/picks' }}
          />

          <Link
            href={`/picks/${featuredPick.slug}`}
            className="group block bg-surface rounded-xl overflow-hidden border border-soft hover:border-accent-border/40 hover:-translate-y-1 transition-all"
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
                  <div className="w-full h-full flex items-center justify-center bg-surface-raised">
                    <StarIcon className="w-12 h-12 text-accent-text/40" strokeWidth={1.5} />
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

      {/* ── Boss Daddy merch — the store lives at /shop; this is its discovery strip ── */}
      <MerchStrip />

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
    </>
  )
}
