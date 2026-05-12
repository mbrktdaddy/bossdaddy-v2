import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import CodeRedirect from './_components/CodeRedirect'
import { LatestGuidesSection } from './_components/LatestGuidesSection'
import BenchStrip from '@/components/BenchStrip'
import { HomepageMerchStrip } from '@/components/HomepageMerchStrip'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Reviews, Guides, and Gear for Boss Dads',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: featuredReviews },
    { data: latestReviews },
  ] = await Promise.all([
    // Hero review — prefers an admin-flagged `featured` review, falls back
    // to the highest-rated approved review (newest tiebreaker)
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('featured', { ascending: false })
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(1),
    // Latest reviews for the card grid further down
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  const featuredReview = featuredReviews?.[0] ?? null

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── Hero ─────────────────────────────────────────────────────────────
          Split layout: copy + CTAs on the left, top-rated review card on the
          right serving as the visual anchor (replaces text-only-on-gradient).
          Falls back to single-column centered text when no reviews exist yet. */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(204,85,0,0.18), transparent 70%), linear-gradient(180deg, rgba(204,85,0,0.10), transparent 70%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24">
          {featuredReview ? (
            <div className="grid lg:grid-cols-[1fr_1.05fr] gap-10 lg:gap-14 items-center">
              {/* Copy column */}
              <div>
                <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-orange-500 mb-5">
                  Dad Like A BOSS.
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight mb-5 text-white">
                  Reviews, Guides, and Gear{' '}
                  <span className="text-orange-500">for Boss Dads.</span>
                </h1>
                <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
                  Tested firsthand with my own money. No sponsors, no paid placements, no BS.
                </p>
                <div className="flex flex-wrap items-center gap-3 mb-5">
                  <Link
                    href="/reviews"
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors"
                  >
                    See This Month&apos;s Top Picks →
                  </Link>
                  <Link
                    href="#crew"
                    className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold rounded-2xl transition-colors"
                  >
                    Join the Crew
                  </Link>
                </div>
                <Link
                  href="/about"
                  className="inline-block text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
                >
                  Read my story →
                </Link>
              </div>

              {/* Featured review card — visual anchor */}
              <Link
                href={`/reviews/${featuredReview.slug}`}
                className="group block bg-gray-900 rounded-2xl overflow-hidden shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-black/60 transition-all duration-200"
              >
                {featuredReview.image_url && (
                  <div className="relative w-full aspect-[5/4] bg-gray-800">
                    <Image
                      src={featuredReview.image_url}
                      alt={featuredReview.product_name}
                      fill
                      priority
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 1024px) 100vw, 520px"
                    />
                    <span className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-black/40">
                      Editor&apos;s Pick · Top Rated
                    </span>
                    {(featuredReview.rating ?? 0) >= 8 && (
                      <div className="absolute top-4 right-4">
                        <BossApprovedBadge size="sm" variant="card" />
                      </div>
                    )}
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3 gap-3">
                    <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                      {featuredReview.product_name}
                    </span>
                    <RatingScore rating={featuredReview.rating ?? 0} />
                  </div>
                  <h2 className="text-xl md:text-2xl font-black leading-tight text-white group-hover:text-orange-400 transition-colors mb-3">
                    {featuredReview.title}
                  </h2>
                  {featuredReview.excerpt && (
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                      {featuredReview.excerpt}
                    </p>
                  )}
                  <p className="text-sm text-orange-500 font-semibold mt-4">Read review →</p>
                </div>
              </Link>
            </div>
          ) : (
            // Fallback: centered text-only when no reviews exist yet
            <div className="max-w-3xl mx-auto text-center py-12">
              <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-orange-500 mb-5">
                Dad Like A BOSS.
              </p>
              <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight mb-6 text-white">
                Reviews, Guides, and Gear{' '}
                <span className="text-orange-500">for Boss Dads.</span>
              </h1>
              <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-8 max-w-2xl mx-auto">
                Tested firsthand with my own money. No sponsors, no paid placements, no BS.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/reviews"
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors"
                >
                  Browse Reviews
                </Link>
                <Link
                  href="/guides"
                  className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold rounded-2xl transition-colors"
                >
                  Browse Guides
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Trust strip ─────────────────────────────────────────────────────
          Elevated treatment: icon badges + uppercase labels in a four-up grid
          on desktop, two-up on mobile. This is the strongest trust signal on
          the page and now has visual weight to match. */}
      <section className="bg-gradient-to-b from-gray-950 to-gray-900/30 border-y border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-6">
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

      {/* ── The Rules ───────────────────────────────────────────────────────
          Typography-led rhythm break. No images, no cards — just a numbered
          three-rule manifesto in brand voice. Sits between the trust strip
          and the discovery sections so trust is built before exploration. */}
      <section className="relative border-b border-gray-800/40">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-orange-600/40" />
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-24">
          <p className="text-[11px] md:text-xs text-orange-500 uppercase tracking-[0.3em] font-bold mb-4 text-center">— The Rules</p>
          <h2 className="text-3xl md:text-4xl font-black text-center text-white mb-4 leading-tight">
            Three rules. That&apos;s the whole standard.
          </h2>
          <p className="text-gray-400 text-center mb-14 max-w-xl mx-auto text-sm md:text-base">
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
              <div key={rule.n}>
                <p className="text-5xl md:text-6xl font-black text-orange-500/30 mb-4 leading-none tabular-nums">
                  {rule.n}
                </p>
                <p className="text-xl font-black text-white mb-3">{rule.title}</p>
                <p className="text-gray-400 leading-relaxed text-sm">{rule.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Browse by Category ──────────────────────────────────────────── */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">— Browse by Category</p>
          <h2 className="text-2xl font-black mb-8">What kind of dad stuff are you into?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className="group flex flex-col items-center text-center gap-2 p-4 bg-gray-900 rounded-2xl border border-gray-800 hover:border-orange-900/60 hover:bg-gray-800 shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 transition-all"
              >
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors leading-tight">
                  {cat.label}
                </span>
                <span className="text-xs text-gray-500 line-clamp-2 leading-relaxed hidden sm:block">
                  {cat.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── On the Bench ────────────────────────────────────────────────── */}
      <section>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="mb-4">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">— On the Bench</p>
            <p className="text-sm text-gray-500">Products on my wishlist to test next.</p>
          </div>
          <Suspense fallback={null}>
            <BenchStrip />
          </Suspense>
        </div>
      </section>

      {/* ── Latest Guides (editorial list — rhythm break vs Recent Reviews) ─ */}
      <Suspense fallback={<LatestGuidesSkeleton />}>
        <LatestGuidesSection />
      </Suspense>

      {/* ── Recent Reviews (card grid) ──────────────────────────────────── */}
      {latestReviews && latestReviews.length > 0 && (
        <section>
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">— Recent Reviews</p>
                <h2 className="text-2xl font-black text-white">Bought, tested, and Boss Daddy Approved</h2>
              </div>
              <Link href="/reviews" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {latestReviews.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
                >
                  {r.image_url && (
                    <div className="relative w-full h-44 bg-gray-800 shrink-0">
                      <Image
                        src={r.image_url}
                        alt={r.product_name}
                        fill
                        priority={i === 0}
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {(r.rating ?? 0) >= 8 && (
                        <div className="absolute top-3 right-3">
                          <BossApprovedBadge size="sm" variant="card" />
                        </div>
                      )}
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
                    <div className="flex items-center justify-between mt-4 pt-4">
                      <span className="text-xs text-gray-600">
                        {r.published_at
                          ? new Date(r.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : ''}
                      </span>
                      <span className="text-xs text-orange-500 font-medium">Read review</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Merch strip — moved below content so editorial credibility is
          established before the store pitch ─────────────────────────────── */}
      <Suspense fallback={null}>
        <HomepageMerchStrip />
      </Suspense>

      {/* ── Newsletter ──────────────────────────────────────────────────── */}
      <section id="crew" className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 rounded-2xl shadow-xl shadow-black/40 px-8 py-12 text-center max-w-2xl mx-auto">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">
            — Join the Boss Daddy Crew
          </p>
          <h2 className="text-2xl font-black text-white mb-3">
            Real Talk. Honest Reviews.<br />No BS Ever.
          </h2>
          <p className="text-gray-400 mb-8">
            The good stuff, straight from the trenches — reviews, wins, and real talk from a dad who shows up.
            No spam. No sponsors. Just the crew.
          </p>
          <form action="/api/newsletter/subscribe" method="POST" className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors text-sm whitespace-nowrap"
            >
              Join Free
            </button>
          </form>
          <p className="text-xs text-gray-600 mt-4">Unsubscribe anytime. We mean it.</p>
        </div>
      </section>

      {/* ── Closing tagline + CTA ──────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-orange-600/40" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-6">— The Bottom Line</p>
          <p className="text-3xl md:text-5xl font-black text-white leading-[1.1] mb-10">
            Now let&apos;s dad like a BOSS —{' '}
            <span className="text-orange-500">together.</span>
          </p>
          <Link
            href="/reviews"
            className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors"
          >
            See the latest reviews →
          </Link>
        </div>
      </section>
    </>
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
      <span className="w-7 h-7 rounded-lg bg-orange-950/40 border border-orange-900/40 flex items-center justify-center text-orange-400 shrink-0 group-hover:border-orange-700/60 transition-colors">
        {icon}
      </span>
      <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-gray-300 group-hover:text-white transition-colors leading-tight">
        {label}
      </span>
    </span>
  )
  return href ? <Link href={href}>{inner}</Link> : <span className="cursor-default">{inner}</span>
}

function LatestGuidesSkeleton() {
  // Mirrors the new editorial list treatment — three rows, not a card grid.
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-8">
        <div className="h-3 w-32 bg-gray-900 rounded mb-3 animate-pulse" />
        <div className="h-7 w-72 bg-gray-900 rounded animate-pulse" />
      </div>
      <div className="divide-y divide-gray-800/60">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 py-6">
            <div className="w-12 h-10 bg-gray-900 rounded animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
              <div className="h-5 w-full bg-gray-800 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-gray-800 rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 sm:w-28 sm:h-24 bg-gray-800/50 rounded-xl animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}
