import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import HeroCarousel from '@/components/HeroCarousel'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Dad Like a Boss',
  description: 'Honest gear reviews, real dad skills, and a brotherhood for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
}


const STATS = [
  { value: '20+', label: 'Products Tested' },
  { value: '35+', label: 'Articles Written' },
  { value: '100%', label: 'Self-Purchased' },
  { value: '0', label: 'Sponsored Posts' },
]


export default async function HomePage() {
  const supabase = await createClient()

  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(12)

  if (reviewsError) console.error('Reviews query error:', reviewsError)

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(3)

  if (articlesError) console.error('Articles query error:', articlesError)

  return (
    <>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-gray-800/60">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">

            {/* Left: hero copy */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Zero Sponsors. Zero Fluff. 100% Real.
              </div>
              <h1 className="text-5xl md:text-7xl leading-[1.0] tracking-tight mb-4 text-white">
                Dad Like
                <br />
                <span className="text-orange-500">a Boss.</span>
              </h1>
              <p className="text-gray-400 text-base md:text-lg leading-relaxed mb-3 max-w-xl">
                Honest gear reviews, real skills, and a brotherhood for dads who show up every single day —
                strong, present, and proud.
              </p>
              <p className="text-orange-400/80 text-sm font-semibold tracking-wide mb-8">
                Show Up. Get Better. Never Settle.
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <Link href="/reviews" className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors">
                  Browse Reviews
                </Link>
                <Link href="/articles" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white font-semibold rounded-xl transition-colors">
                  Read the Blog →
                </Link>
              </div>
            </div>

            {/* Right: top picks carousel */}
            {reviews && reviews.length > 0 && (
              <HeroCarousel reviews={reviews.slice(0, 5)} />
            )}

          </div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-800/60 bg-gray-900/40">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-black text-orange-500">{s.value}</p>
                <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ── Categories ────────────────────────────────────────────────────── */}
      <section className="py-16 border-b border-gray-800/60 overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 mb-6">
          <h2 className="text-3xl font-black text-white mb-1">Browse by Category</h2>
          <p className="text-gray-500 text-sm">Backyard tested. Boss approved.</p>
        </div>
        {/* Mobile: full-width scroll strip */}
        <div className="overflow-x-auto scrollbar-hide sm:hidden">
          <div className="flex gap-3 px-6 pb-2">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/reviews?category=${cat.slug}`}
                className={`group shrink-0 w-28 flex flex-col items-center justify-center rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.color} hover:scale-[1.03] transition-transform duration-200 py-6 px-2`}
              >
                <div className="text-4xl mb-3">{cat.icon}</div>
                <p className={`text-xs font-bold text-center leading-snug ${cat.accent}`}>{cat.label}</p>
              </Link>
            ))}
          </div>
        </div>
        {/* Desktop: full-width grid */}
        <div className="hidden sm:grid sm:grid-cols-7 gap-3 max-w-6xl mx-auto px-6">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/reviews?category=${cat.slug}`}
              className={`group flex flex-col items-center justify-center rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.color} hover:scale-[1.03] transition-transform duration-200 py-6 px-2`}
            >
              <div className="text-4xl mb-3">{cat.icon}</div>
              <p className={`text-xs font-bold text-center leading-snug ${cat.accent}`}>{cat.label}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest Reviews ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-black text-white">Latest Reviews</h2>
            <p className="text-gray-500 text-sm mt-1">Bought, tested, and Boss Daddy Approved</p>
          </div>
          <Link href="/reviews" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
            View all →
          </Link>
        </div>

        {!reviews?.length ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600">Reviews dropping soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.slice(0, 6).map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
              >
                {r.image_url && (
                  <div className="relative w-full h-44 bg-gray-800 shrink-0">
                    <Image
                      src={r.image_url}
                      alt={r.product_name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {r.rating >= 9 && (
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
                    <RatingScore rating={r.rating} />
                  </div>
                  <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {r.title}
                  </h3>
                  {r.excerpt && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-600">
                      {r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                    <span className="text-xs text-orange-500 font-medium">Read review →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Latest Articles ───────────────────────────────────────────────── */}
      {articles && articles.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-black text-white">From the Blog</h2>
              <p className="text-gray-500 text-sm mt-1">Guides, skills, and dad wisdom</p>
            </div>
            <Link href="/articles" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {articles.map((a) => (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
              >
                {a.image_url ? (
                  <div className="relative w-full h-44 bg-gray-800 shrink-0 overflow-hidden">
                    <Image
                      src={a.image_url}
                      alt={a.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="w-full h-44 shrink-0 bg-gradient-to-br from-gray-800/50 to-gray-900/40 flex items-center justify-center">
                    <span className="text-4xl opacity-40">📝</span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <h3 className="font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {a.title}
                  </h3>
                  {a.excerpt && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{a.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-600">
                      {a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                    <div className="flex items-center gap-3">
                      {a.reading_time_minutes && (
                        <span className="text-xs text-gray-600">{a.reading_time_minutes} min read</span>
                      )}
                      <span className="text-xs text-orange-500 font-medium">Read →</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Shop Teaser ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden px-8 py-10">

          {/* Product image strip — horizontal, centered */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            {reviews
              ?.filter((r) => r.image_url)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 6)
              .map((r) => (
                <div key={r.id} className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-800">
                  <Image
                    src={r.image_url!}
                    alt={r.product_name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 33vw, 16vw"
                  />
                </div>
              ))}
          </div>

          {/* Copy + CTA */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Boss Daddy Shop</p>
              <h2 className="text-2xl font-black text-white mb-2">The Boss Daddy Gear List</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Every product we&apos;ve tested and actually stand behind — all in one place.
              </p>
            </div>
            <Link
              href="/reviews"
              className="shrink-0 px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors"
            >
              Shop the List →
            </Link>
          </div>

        </div>
      </section>

      {/* ── Join the Crew / Newsletter ────────────────────────────────────── */}
      <section id="crew" className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-800/30 rounded-3xl px-8 py-12 text-center max-w-2xl mx-auto">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Join the Boss Daddy Crew
          </p>
          <h2 className="text-3xl font-black text-white mb-3">
            Real Talk. Honest Reviews.<br />No BS Ever.
          </h2>
          <p className="text-gray-400 mb-8">
            Weekly reviews, gear picks, and dad-life wins from a real dad in the trenches.
            No spam. No sponsors. Just the crew.
          </p>
          <form action="/api/newsletter/subscribe" method="POST" className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors text-sm whitespace-nowrap"
            >
              Join Free
            </button>
          </form>
          <p className="text-xs text-gray-600 mt-4">Unsubscribe anytime. We mean it.</p>
        </div>
      </section>

      {/* ── Closing Tagline ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-10 text-center">
        <p className="text-4xl md:text-5xl font-black text-white">
          Now let&apos;s dad like a boss —{' '}
          <span className="text-orange-500">together.</span>
        </p>
      </section>

    </>
  )
}
