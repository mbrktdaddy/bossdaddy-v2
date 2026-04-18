import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES } from '@/lib/categories'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Dad Like a Boss',
  description: 'Honest gear reviews, real dad skills, and a brotherhood for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

const STATS = [
  { value: '20+', label: 'Products Tested' },
  { value: '35+', label: 'Articles Written' },
  { value: '100%', label: 'Self-Purchased' },
  { value: '0', label: 'Sponsored Posts' },
]

const RTB = [
  {
    headline: 'Zero Fluff. Zero Sponsors. 100% Real.',
    body: 'Every product bought with our own money. No brand deals, no paid placements — ever.',
    icon: '🎯',
  },
  {
    headline: 'Show Up. Get Better. Never Settle.',
    body: "The founder's daily standard. The same standard every review is held to.",
    icon: '💪',
  },
  {
    headline: 'Real Dads + Smart Tech = Trust You Can Use.',
    body: 'AI-assisted research. Human-verified verdicts. Depth without shortcuts.',
    icon: '⚙️',
  },
]

export default async function HomePage() {
  const supabase = await createClient()

  const { data: reviews, error: reviewsError } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(6)

  if (reviewsError) console.error('Reviews query error:', reviewsError)

  const { data: articles, error: articlesError } = await supabase
    .from('articles')
    .select('id, slug, title, category, excerpt, published_at')
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
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Zero Sponsors. Zero Fluff. 100% Real.
            </div>
            <h1
              className="text-5xl md:text-7xl leading-[1.0] tracking-tight mb-4 text-white"
            >
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
              <Link href="#crew" className="px-6 py-3 text-gray-300 hover:text-white font-medium transition-colors">
                Join the Crew →
              </Link>
            </div>
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

      {/* ── RTB Three Pillars ─────────────────────────────────────────────── */}
      <section className="border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {RTB.map((r) => (
              <div key={r.headline} className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
                <div className="text-2xl mb-4">{r.icon}</div>
                <h3
                  className="text-base text-white mb-2 leading-snug"
                >
                  {r.headline}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categories ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <h2
          className="text-3xl text-white mb-2"
        >
          Browse by Category
        </h2>
        <p className="text-gray-500 text-sm mb-8">Backyard tested. Boss approved.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className={`group relative overflow-hidden rounded-2xl border ${cat.border} bg-gradient-to-br ${cat.color} p-6 hover:scale-[1.02] transition-transform duration-200`}
            >
              <div className="text-3xl mb-3">{cat.icon}</div>
              <h3 className={`font-bold text-base mb-1.5 ${cat.accent}`}>{cat.label}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{cat.description}</p>
              <span className="absolute bottom-4 right-4 text-xs text-gray-600 group-hover:text-gray-400 transition-colors">
                Explore →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Latest Reviews ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2
              className="text-3xl text-white"
            >
              Latest Reviews
            </h2>
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
            {reviews.map((r) => (
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
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                      {r.product_name}
                    </span>
                    <StarRating rating={r.rating} />
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
              <h2
                className="text-3xl text-white"
              >
                From the Blog
              </h2>
              <p className="text-gray-500 text-sm mt-1">Guides, skills, and dad wisdom</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {articles.map((a) => (
              <Link
                key={a.id}
                href={`/articles/${a.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all"
              >
                <h3 className="font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                  {a.title}
                </h3>
                {a.excerpt && (
                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">{a.excerpt}</p>
                )}
                <p className="text-xs text-gray-600 mt-4">
                  {a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Join the Crew / Newsletter ────────────────────────────────────── */}
      <section id="crew" className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 border border-orange-800/30 rounded-3xl px-8 py-12 text-center max-w-2xl mx-auto">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Join the Boss Daddy Crew
          </p>
          <h2
            className="text-3xl text-white mb-3"
          >
            Real Talk. Honest Reviews.<br />No BS Ever.
          </h2>
          <p className="text-gray-400 mb-8">
            Weekly reviews, gear picks, and dad-life wins from a real dad in the trenches.
            No spam. No sponsors. Just the crew.
          </p>
          <form action="/api/newsletter/subscribe" method="POST" className="flex gap-3 max-w-md mx-auto">
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

      {/* ── Shop Teaser ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 border-b border-gray-800/60">
        <div className="bg-gray-900 border border-gray-800 rounded-3xl px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Boss Daddy Shop</p>
            <h2
              className="text-2xl text-white mb-2"
            >
              The Boss Daddy Gear List
            </h2>
            <p className="text-gray-400 text-sm max-w-md">
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
      </section>

      {/* ── Closing Tagline ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <p className="text-gray-600 text-sm uppercase tracking-widest mb-3">Welcome to the crew.</p>
        <p
          className="text-4xl md:text-5xl text-white"
        >
          Now let&apos;s dad like a boss —{' '}
          <span className="text-orange-500">together.</span>
        </p>
      </section>

    </>
  )
}
