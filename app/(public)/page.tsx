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
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Dad Like a Boss',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: featuredReviews },
    { data: latestReviews },
  ] = await Promise.all([
    // Top-rated review for the editorial pick slot
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(1),
    // Latest reviews for the recent strip
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% -10%, rgba(204,85,0,0.18), transparent 70%), linear-gradient(180deg, rgba(204,85,0,0.10), transparent 70%)',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-6 py-24 md:py-32 text-center">
          <h1 className="text-6xl md:text-[7.5rem] leading-[0.92] tracking-tight mb-6 text-white">
            Dad Like
            <br />
            <span className="text-orange-500">a Boss.</span>
          </h1>
          <p className="text-[11px] md:text-xs uppercase tracking-[0.2em] font-bold text-orange-500 mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>Real Dads</span>
            <span className="text-orange-800">·</span>
            <span>Real Reviews</span>
            <span className="text-orange-800">·</span>
            <span>Smart Tech</span>
          </p>

          {/* Identity — who this is and why it exists */}
          <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-4 max-w-2xl mx-auto">
            Reviews, guides, and really cool stuff for Dads who show up every single day.
            Everything here is tested firsthand with my own money — no sponsors, no paid placements, no BS.
          </p>
          <Link
            href="/about"
            className="inline-block text-sm text-orange-400 hover:text-orange-300 font-semibold transition-colors mb-10"
          >
            Read my story →
          </Link>

          <div className="flex items-center justify-center gap-3">
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
      </section>

      {/* ── Trust signals strip ──────────────────────────────────────────── */}
      <section className="border-t border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-4">
          {/* Mobile: 2×2 grid — no orphaned separators */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:hidden">
            {[
              { label: 'How We Test', href: '/how-we-test' },
              { label: 'Editorial Standards', href: '/editorial-standards' },
              { label: 'Affiliate Disclosure', href: '/affiliate-disclosure' },
            ].map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="text-[11px] text-gray-500 hover:text-orange-400 transition-colors font-medium uppercase tracking-widest text-center"
              >
                {label}
              </Link>
            ))}
            <span className="text-[11px] text-gray-600 font-medium uppercase tracking-widest text-center">
              Zero Paid Placements
            </span>
          </div>
          {/* Desktop: single row with dot separators */}
          <div className="hidden sm:flex items-center justify-center gap-6">
            <Link href="/how-we-test" className="text-xs text-gray-500 hover:text-orange-400 transition-colors font-medium uppercase tracking-widest">
              How We Test
            </Link>
            <span className="text-gray-700 text-xs">·</span>
            <Link href="/editorial-standards" className="text-xs text-gray-500 hover:text-orange-400 transition-colors font-medium uppercase tracking-widest">
              Editorial Standards
            </Link>
            <span className="text-gray-700 text-xs">·</span>
            <Link href="/affiliate-disclosure" className="text-xs text-gray-500 hover:text-orange-400 transition-colors font-medium uppercase tracking-widest">
              Affiliate Disclosure
            </Link>
            <span className="text-gray-700 text-xs">·</span>
            <span className="text-xs text-gray-600 font-medium uppercase tracking-widest">Zero Paid Placements</span>
          </div>
        </div>
      </section>

      {/* ── Boss Daddy's Pick ────────────────────────────────────────────── */}
      {featuredReview && (
        <section className="relative">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-600/50 to-transparent" />
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="flex items-stretch justify-between gap-4 mb-8">
              <div className="flex items-stretch gap-4">
                <div className="w-[3px] bg-orange-600 rounded-full" />
                <div>
                  <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-2">Start Here</p>
                  <h2 className="text-2xl font-black text-white leading-tight">Boss Daddy&apos;s Pick</h2>
                </div>
              </div>
              <Link
                href="/reviews"
                className="hidden sm:inline-flex items-center self-end text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
              >
                All Reviews
              </Link>
            </div>
            <Link
              href={`/reviews/${featuredReview.slug}`}
              className="group flex flex-col md:flex-row bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
            >
              {featuredReview.image_url && (
                <div className="relative w-full md:w-1/2 h-72 md:h-auto md:min-h-[380px] bg-gray-800 shrink-0">
                  <Image
                    src={featuredReview.image_url}
                    alt={featuredReview.product_name}
                    fill
                    priority
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <span className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-black/40">
                    Top Rated
                  </span>
                  {(featuredReview.rating ?? 0) >= 8 && (
                    <div className="absolute top-4 right-4">
                      <BossApprovedBadge size="sm" variant="card" />
                    </div>
                  )}
                </div>
              )}
              <div className="p-8 md:p-10 flex flex-col flex-1 justify-center">
                <div className="flex items-center justify-between mb-4 gap-3">
                  <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                    {featuredReview.product_name}
                  </span>
                  <RatingScore rating={featuredReview.rating ?? 0} />
                </div>
                <h3 className="text-2xl md:text-3xl font-black leading-tight mb-3 text-white group-hover:text-orange-400 transition-colors">
                  {featuredReview.title}
                </h3>
                {featuredReview.excerpt && (
                  <p className="text-gray-400 text-base leading-relaxed line-clamp-3">
                    {featuredReview.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between mt-6 pt-4">
                  <span className="text-sm text-gray-500">
                    {featuredReview.published_at
                      ? new Date(featuredReview.published_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : ''}
                  </span>
                  <span className="text-sm text-orange-500 font-semibold">Read review →</span>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* ── Browse by Category ──────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Browse by Category</p>
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
          <Suspense fallback={null}>
            <BenchStrip />
          </Suspense>
        </div>
      </section>

      {/* ── Latest Guides ───────────────────────────────────────────────── */}
      <Suspense fallback={<LatestGuidesSkeleton />}>
        <LatestGuidesSection />
      </Suspense>

      {/* ── Recent Reviews ──────────────────────────────────────────────── */}
      {latestReviews && latestReviews.length > 0 && (
        <section>
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white">Recent Reviews</h2>
                <p className="text-gray-500 text-sm mt-1">Bought, tested, and Boss Daddy Approved</p>
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

      {/* ── Newsletter ──────────────────────────────────────────────────── */}
      <section id="crew" className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 rounded-2xl shadow-xl shadow-black/40 px-8 py-12 text-center max-w-2xl mx-auto">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Join the Boss Daddy Crew
          </p>
          <h2 className="text-2xl font-black text-white mb-3">
            Real Talk. Honest Reviews.<br />No BS Ever.
          </h2>
          <p className="text-gray-400 mb-8">
            Monthly recap, the good stuff, and dad-life wins from a real dad in the trenches.
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

      {/* ── Closing Tagline ─────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-px bg-orange-600/40" />
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-6">— The Bottom Line</p>
          <p className="text-3xl md:text-5xl font-black text-white leading-[1.1]">
            Now let&apos;s dad like a boss —{' '}
            <span className="text-orange-500">together.</span>
          </p>
        </div>
      </section>
    </>
  )
}

function LatestGuidesSkeleton() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <div className="h-8 w-48 bg-gray-900 rounded mb-8 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="w-full h-44 bg-gray-800/50 animate-pulse" />
            <div className="p-5 space-y-3">
              <div className="h-3 w-20 bg-gray-800 rounded animate-pulse" />
              <div className="h-5 w-full bg-gray-800 rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-gray-800 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
