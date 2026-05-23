import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import CodeRedirect from './_components/CodeRedirect'
import { LatestGuidesSection } from './_components/LatestGuidesSection'
import BenchStrip from '@/components/BenchStrip'
import InMotionTicker from '@/components/InMotionTicker'
import { HomepageMerchStrip } from '@/components/HomepageMerchStrip'
import { EmailSignup } from '@/components/EmailSignup'
import { OCCASIONS } from '@/lib/gift-occasions'
import type { Metadata } from 'next'

// Used by the From-The-Vault strip; small inline shape rather than reaching
// for the full DB row type since we only consume a few fields here.
interface VaultStripCard {
  slug:            string
  title:           string
  description:     string | null
  hero_image_url:  string | null
  collection_type: string
  occasion:        string | null
}

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Reviews, Guides, and Gear for Boss Dads',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const supabase = await createClient()

  // Resolve homepage hero: site_settings pointer → reviews.featured → algorithmic.
  // A guide can take the hero slot when the admin pins one; otherwise it's a review.
  const { data: settings } = await supabase
    .from('site_settings')
    .select('homepage_hero_type, homepage_hero_id')
    .eq('id', 1)
    .single()

  const [
    { data: heroReviewByOverride },
    { data: heroReviewByFeatured },
    { data: heroGuide },
    { data: latestReviewsRaw },
    { data: vaultPicksRaw },
  ] = await Promise.all([
    // If admin pinned a specific review as hero, fetch it.
    settings?.homepage_hero_type === 'review' && settings.homepage_hero_id
      ? supabase
          .from('reviews')
          .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
          .eq('id', settings.homepage_hero_id)
          .eq('status', 'approved')
          .eq('is_visible', true)
          .limit(1)
      : Promise.resolve({ data: null }),
    // Featured review fallback (also used by /reviews top card; we read it
    // here so the same hero shows on / when no explicit override is set).
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('featured', { ascending: false })
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(1),
    // If admin pinned a guide as hero, fetch it.
    settings?.homepage_hero_type === 'guide' && settings.homepage_hero_id
      ? supabase
          .from('guides')
          .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
          .eq('id', settings.homepage_hero_id)
          .eq('status', 'approved')
          .eq('is_visible', true)
          .limit(1)
      : Promise.resolve({ data: null }),
    // Fetch 4 latest; we filter out whichever ends up as the hero feature so the
    // Recent Reviews grid never duplicates the hero card.
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(4),
    // Up to 6 recent Vault collections — we pick a diverse trio downstream
    // (one comparison + one pick/best-of + one stack/gift_guide) so the
    // homepage strip signals the breadth of editorial content beyond reviews.
    supabase
      .from('collections')
      .select('slug, title, description, hero_image_url, collection_type, occasion, published_at')
      .eq('is_visible', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12),
  ])

  // Hero resolution: explicit guide override > explicit review override >
  // featured/top-rated review fallback. The first that resolves wins.
  const overrideGuide  = heroGuide?.[0] ?? null
  const overrideReview = heroReviewByOverride?.[0] ?? null
  const fallbackReview = heroReviewByFeatured?.[0] ?? null

  const featuredHero = overrideGuide
    ? { kind: 'guide' as const, data: overrideGuide }
    : (overrideReview ?? fallbackReview)
      ? { kind: 'review' as const, data: overrideReview ?? fallbackReview! }
      : null

  // Back-compat alias for the JSX below (which references featuredReview).
  const featuredReview = featuredHero?.kind === 'review' ? featuredHero.data : null
  const latestReviews = (latestReviewsRaw ?? [])
    .filter((r) => r.id !== featuredReview?.id)
    .slice(0, 3)

  // Pick a diverse Vault trio — one of each flavor when possible, falling
  // back to whatever's most recent. Order on the homepage strip: Comparison →
  // Pick → Stack → Gift Guide (drops as needed when we hit 3).
  const vaultPool = (vaultPicksRaw ?? []) as VaultStripCard[]
  const vaultTrio: VaultStripCard[] = []
  for (const t of ['comparison', 'best_of', 'general', 'stack', 'gift_guide']) {
    const first = vaultPool.find((v) => v.collection_type === t && !vaultTrio.includes(v))
    if (first) vaultTrio.push(first)
    if (vaultTrio.length >= 3) break
  }

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── In Motion ticker — auto-fed from Bench testing/queued items.
            Renders nothing when nothing's in motion. ────────────────────── */}
      <Suspense fallback={null}>
        <InMotionTicker />
      </Suspense>

      {/* ── Hero — cream-paper magazine-cover treatment.
            No gradient washes, no splash decoration. The cream bg IS the
            visual treatment; typography + the featured card carry the
            rest. Thin brand-orange hairline at bottom of the hero acts
            as a magazine masthead binding line. ───────────────────── */}
      <section className="relative overflow-hidden bg-surface-sunken border-b-2 border-accent-brand/70">
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          {featuredHero ? (
            <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
              {/* Copy column */}
              <div>
                <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-accent-text mb-5">
                  Dad Like A BOSS.
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5 text-prose">
                  Reviews, Guides, and Gear{' '}
                  <span className="text-accent-text">for Boss Dads.</span>
                </h1>
                <p className="text-prose-muted text-base md:text-lg leading-relaxed mb-8 max-w-xl">
                  Tested firsthand with my own money. No sponsors, no paid placements, no BS.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <Link
                    href="/reviews"
                    className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-2xl transition-colors"
                  >
                    See This Month&apos;s Top Picks →
                  </Link>
                  <Link
                    href="/guides"
                    className="px-6 py-3 bg-white border border-strong hover:border-prose/40 text-prose font-semibold rounded-2xl transition-colors"
                  >
                    Browse Guides
                  </Link>
                </div>
                <Link
                  href="/about"
                  className="inline-block text-sm text-accent-text-soft hover:text-accent font-medium transition-colors"
                >
                  Read my story →
                </Link>
              </div>

              {featuredHero.kind === 'review' ? (
                <Link
                  href={`/reviews/${featuredHero.data.slug}`}
                  className="group block bg-gradient-to-br from-surface to-surface/60 rounded-2xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-xl shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-2xl hover:shadow-stone-900/[0.10] hover:-translate-y-0.5 transition-all duration-200"
                >
                  {featuredHero.data.image_url && (
                    <div className="relative w-full aspect-[5/4] bg-surface-raised">
                      <Image
                        src={featuredHero.data.image_url}
                        alt={featuredHero.data.product_name}
                        fill
                        priority
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 1024px) 100vw, 520px"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {(() => {
                          const cat = getCategoryBySlug(featuredHero.data.category)
                          return cat ? (
                            <>
                              <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                              <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                                {cat.label}
                              </span>
                            </>
                          ) : null
                        })()}
                      </div>
                      <RatingScore rating={featuredHero.data.rating ?? 0} />
                    </div>
                    <h2 className="text-xl md:text-2xl font-black leading-tight text-prose group-hover:text-accent-text-soft transition-colors mb-3">
                      {featuredHero.data.title}
                    </h2>
                    {featuredHero.data.excerpt && (
                      <p className="text-prose-muted text-sm leading-relaxed line-clamp-2">
                        {featuredHero.data.excerpt}
                      </p>
                    )}
                    <p className="text-sm text-accent-text font-semibold mt-4">Read review →</p>
                  </div>
                </Link>
              ) : (
                <Link
                  href={`/guides/${featuredHero.data.slug}`}
                  className="group block bg-gradient-to-br from-surface to-surface/60 rounded-2xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-xl shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-2xl hover:shadow-stone-900/[0.10] hover:-translate-y-0.5 transition-all duration-200"
                >
                  {featuredHero.data.image_url && (
                    <div className="relative w-full aspect-[5/4] bg-surface-raised">
                      <Image
                        src={featuredHero.data.image_url}
                        alt={featuredHero.data.title}
                        fill
                        priority
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 1024px) 100vw, 520px"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {(() => {
                          const cat = getCategoryBySlug(featuredHero.data.category ?? '')
                          return cat ? (
                            <>
                              <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                              <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                                {cat.label}
                              </span>
                            </>
                          ) : null
                        })()}
                      </div>
                      {featuredHero.data.reading_time_minutes && (
                        <span className="text-xs text-prose-faint tabular-nums shrink-0">
                          {featuredHero.data.reading_time_minutes} min read
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl md:text-2xl font-black leading-tight text-prose group-hover:text-accent-text-soft transition-colors mb-3">
                      {featuredHero.data.title}
                    </h2>
                    {featuredHero.data.excerpt && (
                      <p className="text-prose-muted text-sm leading-relaxed line-clamp-2">
                        {featuredHero.data.excerpt}
                      </p>
                    )}
                    <p className="text-sm text-accent-text font-semibold mt-4">Read guide →</p>
                  </div>
                </Link>
              )}
            </div>
          ) : (
            // Fallback: centered text-only when no reviews exist yet
            <div className="max-w-3xl mx-auto text-center py-12">
              <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-accent-text mb-5">
                Dad Like A BOSS.
              </p>
              <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 text-prose">
                Reviews, Guides, and Gear{' '}
                <span className="text-accent-text">for Boss Dads.</span>
              </h1>
              <p className="text-prose-muted text-base md:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
                Tested firsthand with my own money. No sponsors, no paid placements, no BS.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/reviews"
                  className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-2xl transition-colors"
                >
                  Browse Reviews
                </Link>
                <Link
                  href="/guides"
                  className="px-6 py-3 bg-white border border-strong hover:border-prose/40 text-prose font-semibold rounded-2xl transition-colors"
                >
                  Browse Guides
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Page runs on a single neutral dark canvas. Section rhythm comes
          from typography, padding, and per-section accent ticks (the small
          w-6 h-px bg-accent/60 line above each section h2). No bg washes —
          the modern palette doesn't need them. */}

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
            <TrustBadge
              href="/how-we-test"
              label="How We Test"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <TrustBadge
              href="/editorial-standards"
              label="Editorial Standards"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <TrustBadge
              href="/affiliate-disclosure"
              label="Affiliate Disclosure"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              }
            />
            <TrustBadge
              label="Zero Paid Placements"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* ── The Rules — moved up from Movement 2 so the strongest authority
            assertion is right under the hero, not 4 sections deep where
            most mobile readers never reached it. This is the trust *proof*
            that backs the hero's "my own money, no sponsors" *promise*.
            Page bg now — hero wears the cream-paper, so Rules alternates
            back to white to keep rhythm. */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 md:py-20">
          <p className="text-[11px] md:text-xs text-accent-text uppercase tracking-[0.3em] font-bold mb-4 text-center">— The Rules</p>
          <h2 className="text-3xl md:text-4xl font-black text-center text-prose mb-4 leading-tight">
            Three rules. That&apos;s the whole standard.
          </h2>
          <p className="text-prose-muted text-center mb-12 max-w-xl mx-auto text-sm md:text-base">
            Why you can trust what you read here — and why I can tell you the truth without hedging.
          </p>
          <div className="grid md:grid-cols-3 gap-10 md:gap-12">
            {[
              {
                n: '01',
                title: 'I bought it.',
                body: 'My money. No PR samples, no free units, no sponsor influence. Every product on this site is purchased the same way you would buy it.',
              },
              {
                n: '02',
                title: 'I used it.',
                body: 'Weeks, not minutes. My kid, my grill, my garage, my weekends. If a product needs real testing to expose its flaws, it gets real testing.',
              },
              {
                n: '03',
                title: "I'll tell you the truth.",
                body: "If I wouldn't buy it again, I say so. If it changed my life, I say so. The score on the page is the score I'd give a friend.",
              },
            ].map((rule) => (
              <div key={rule.n} className="text-center md:text-left">
                <p className="text-5xl md:text-6xl font-black text-accent-text/30 mb-4 leading-none tabular-nums">
                  {rule.n}
                </p>
                <p className="text-xl font-black text-prose mb-3">{rule.title}</p>
                <p className="text-prose-muted leading-relaxed text-sm max-w-sm mx-auto md:max-w-none md:mx-0">
                  {rule.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories — orientation moment after Rules establishes trust.
            Quiet utility ribbon (single eyebrow + 8 pills) — content weight
            matches visual weight. Placed before Recent Reviews so the reader
            sees the BREADTH of coverage first, then enjoys the curated picks.
            Gift-shoppers (wives/moms) can jump straight to their category
            without scrolling through unrelated featured content. */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold whitespace-nowrap">
              Pick your lane
            </p>

            {/* Mobile: horizontal scroll strip — break out of padded container,
                restore padding inside per CLAUDE.md horizontal-scroll rule */}
            <div className="sm:hidden -mx-6">
              <div className="flex gap-2.5 overflow-x-auto px-6 pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <CategoryPill key={cat.slug} slug={cat.slug} label={cat.shortLabel} />
                ))}
              </div>
            </div>

            {/* Desktop: wrap to fit, all 8 visible at once */}
            <div className="hidden sm:flex flex-wrap gap-2 flex-1 justify-end">
              {CATEGORIES.map((cat) => (
                <CategoryPill key={cat.slug} slug={cat.slug} label={cat.shortLabel} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Reviews — asymmetric magazine grid (1 hero + 2 stacked) ─ */}
      {latestReviews && latestReviews.length > 0 && (
        <section className="relative">
          <div className="relative max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent-brand rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— Recent Reviews</p>
                  <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">Bought, tested, and Boss Daddy Approved</h2>
                </div>
              </div>
              <Link href="/reviews" className="hidden sm:inline-flex items-center text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold shrink-0">
                View all →
              </Link>
            </div>

            {/* Magazine "1 + 2" layout: hero spans 2x2 on lg, smalls stack 1x1 each on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
              {latestReviews.map((r, i) => {
                const isHero = i === 0
                return (
                  <Link
                    key={r.id}
                    href={`/reviews/${r.slug}`}
                    className={`group flex flex-col bg-gradient-to-br from-surface to-surface/60 rounded-2xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-lg shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-xl hover:shadow-stone-900/[0.10] hover:-translate-y-0.5 transition-all duration-200 ${
                      isHero ? 'lg:col-span-2 lg:row-span-2' : ''
                    }`}
                  >
                    {r.image_url && (
                      <div
                        className={`relative w-full bg-surface-raised shrink-0 ${
                          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
                        }`}
                      >
                        <Image
                          src={r.image_url}
                          alt={r.product_name}
                          fill
                          priority={i === 0}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes={
                            isHero
                              ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 680px'
                              : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                          }
                        />
                        {(r.rating ?? 0) >= 8 && (
                          <div className="absolute top-3 right-3">
                            <BossApprovedBadge size="sm" variant="card" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col flex-1 ${isHero ? 'p-6 lg:p-7' : 'p-5'}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {(() => {
                            const cat = getCategoryBySlug(r.category)
                            return cat ? (
                              <>
                                <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                                <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                                  {cat.label}
                                </span>
                              </>
                            ) : null
                          })()}
                        </div>
                        <RatingScore rating={r.rating ?? 0} />
                      </div>
                      <h3
                        className={`leading-snug group-hover:text-accent-text-soft transition-colors flex-1 ${
                          isHero ? 'text-xl md:text-2xl font-black text-prose' : 'text-base font-semibold'
                        }`}
                      >
                        {r.title}
                      </h3>
                      {r.excerpt && (
                        <p
                          className={`text-prose-faint mt-2 ${
                            isHero ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2'
                          }`}
                        >
                          {r.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-4 pt-4">
                        <span className="text-xs text-prose-faint">
                          {r.published_at
                            ? new Date(r.published_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                        <span className="text-xs text-accent-text font-medium">Read review</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── From The Vault — diverse trio of collections.
            Cream-paper band — second rhythm break, separates editorial
            collections from review feed. ───────────────────────────── */}
      {vaultTrio.length > 0 && (
        <section className="relative bg-surface-sunken border-y border-soft">
          <div className="relative max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent-brand rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— From The Vault</p>
                  <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">Comparisons, kits, and curated picks</h2>
                  <p className="mt-2 text-sm text-prose-faint">{LABELS.vault.tagline}</p>
                </div>
              </div>
              <Link
                href="/vault"
                title={LABELS.vault.tagline}
                className="hidden sm:inline-flex items-center text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold shrink-0 whitespace-nowrap"
              >
                Open the Vault →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {vaultTrio.map((card) => {
                const meta = vaultTypeMeta(card.collection_type)
                const href = vaultHrefFor(card)
                return (
                  <Link
                    key={`${card.collection_type}:${card.slug}`}
                    href={href}
                    className="group flex flex-col bg-gradient-to-br from-surface to-surface/60 rounded-2xl overflow-hidden border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] shadow-lg shadow-stone-900/[0.06] hover:border-accent-border/40 hover:shadow-xl hover:shadow-stone-900/[0.10] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="relative aspect-video bg-surface-sunken">
                      {card.hero_image_url ? (
                        <Image src={card.hero_image_url} alt={card.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-accent-text/30">{meta.icon}</div>
                      )}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-surface-sunken/85 backdrop-blur border border-soft rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-text-soft">
                        {meta.label}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <p className="text-base font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-2 line-clamp-2">{card.title}</p>
                      {card.description && (
                        <p className="text-sm text-prose-faint leading-relaxed line-clamp-2 flex-1">{card.description}</p>
                      )}
                      <p className="mt-4 text-xs text-accent-text font-semibold">Read →</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Latest Guides ──────────────────────────────────────────────── */}
      <Suspense fallback={<LatestGuidesSkeleton />}>
        <LatestGuidesSection />
      </Suspense>

      {/* ── On the Bench — BenchStrip ships its own complete header
            (pulsing dot eyebrow + tagline + CTA), so no outer section header here. */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <Suspense fallback={null}>
            <BenchStrip />
          </Suspense>
        </div>
      </section>

      {/* ── Merch strip ────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <HomepageMerchStrip />
      </Suspense>

      {/* ── Newsletter — DARK DRAMATIC MOMENT.
            Full-bleed dark panel against the light page rhythm. Cream
            headline + brand orange accent strip + action-orange CTA.
            Creates the "clubhouse invitation" feel. ─────────────────── */}
      <section id="crew" className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-16">
          <div className="relative bg-drama rounded-2xl shadow-2xl shadow-stone-900/[0.15] px-8 py-14 text-center max-w-3xl mx-auto overflow-hidden">
            {/* Brand-orange left-edge accent — heritage signature on dark */}
            <span aria-hidden className="absolute left-0 inset-y-8 w-0.5 bg-accent-brand rounded-full" />
            {/* Subtle radial warmth from top */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(204,85,0,0.15), transparent 70%)' }}
            />
            <div className="relative">
              <p className="text-accent-text-soft text-xs font-bold uppercase tracking-[0.25em] mb-4">
                Join the Boss Daddy Crew
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-stone-50 mb-4 leading-tight">
                Real Talk. Honest Reviews.<br />No BS Ever.
              </h2>
              <p className="text-stone-300 text-base mb-8 max-w-lg mx-auto">
                The good stuff, straight from the trenches — reviews, wins, and real talk from a dad who shows up.
                No spam. No sponsors. Just the crew.
              </p>
              <div className="max-w-md mx-auto text-left">
                <EmailSignup
                  heading={null}
                  description={null}
                  buttonLabel="Join Free"
                  successMessage="You're in, Boss. Welcome to the crew."
                  interests={['newsletter']}
                />
              </div>
              <p className="text-xs text-stone-500 mt-5 text-center">Unsubscribe anytime. We mean it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing tagline — magazine-style signoff, no CTA button ────── */}
      <section className="relative py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-6">— The Bottom Line</p>
          <p className="text-3xl md:text-5xl font-black text-prose leading-[1.1] mb-10">
            Now let&apos;s dad like a BOSS —{' '}
            <span className="text-accent-text">together.</span>
          </p>
          <p className="text-sm text-prose-faint italic">— Boss Daddy</p>
        </div>
      </section>

    </>
  )
}

function CategoryPill({ slug, label }: { slug: string; label: string }) {
  return (
    <Link
      href={`/category/${slug}`}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-br from-surface to-surface/60 border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] px-4 py-2.5 text-sm font-semibold text-prose min-h-[44px] whitespace-nowrap hover:border-accent-border/60 hover:bg-surface-raised hover:text-accent-text-soft transition-colors"
    >
      <CategoryIcon slug={slug} className="w-4 h-4 text-accent-text shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function TrustBadge({
  href,
  label,
  icon,
}: {
  href?: string
  label: string
  icon: React.ReactNode
}) {
  const inner = (
    <span className="flex items-center gap-2.5 group">
      <span className="w-7 h-7 rounded-lg bg-accent-tint border border-accent-border/40 flex items-center justify-center text-accent-text-soft shrink-0 group-hover:border-accent-border/60 transition-colors">
        {icon}
      </span>
      <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-prose-muted group-hover:text-prose transition-colors leading-tight">
        {label}
      </span>
    </span>
  )
  return href ? <Link href={href}>{inner}</Link> : <span className="cursor-default">{inner}</span>
}

function vaultHrefFor(card: VaultStripCard): string {
  if (card.collection_type === 'gift_guide') {
    if (!card.occasion) return '/gifts'
    const occ = OCCASIONS.find((o) => o.value === card.occasion)
    return occ ? `/gifts/${occ.slug}` : '/gifts'
  }
  if (card.collection_type === 'comparison') return `/comparisons/${card.slug}`
  if (card.collection_type === 'stack')      return `/stacks/${card.slug}`
  return `/picks/${card.slug}`
}

function vaultTypeMeta(type: string): { label: string; icon: React.ReactNode } {
  const cls = 'w-10 h-10'
  if (type === 'comparison') {
    return {
      label: 'Comparison',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>,
    }
  }
  if (type === 'stack') {
    return {
      label: 'Stack',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    }
  }
  if (type === 'gift_guide') {
    return {
      label: 'Gift Guide',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
    }
  }
  return {
    label: type === 'best_of' ? 'Best Of' : 'Pick List',
    icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
  }
}

function LatestGuidesSkeleton() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-8">
        <div className="h-px w-6 bg-surface-raised mb-3" />
        <div className="h-3 w-32 bg-surface rounded mb-3 animate-pulse" />
        <div className="h-7 w-72 bg-surface rounded animate-pulse" />
      </div>
      <div className="divide-y divide-soft">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 py-6">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
              <div className="h-5 w-full bg-surface-raised rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-surface-raised rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 sm:w-28 sm:h-24 bg-surface-raised/50 rounded-xl animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}
