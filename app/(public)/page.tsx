import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import CodeRedirect from './_components/CodeRedirect'
import { LatestGuidesSection } from './_components/LatestGuidesSection'
import { getStatusColor, getStatusLabel, type WishlistItem } from '@/lib/wishlist'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Dad Like a Boss',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}


export default async function HomePage() {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const [
    { data: reviews, error: reviewsError },
    { data: testingNow },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(12),
    adminClient
      .from('wishlist_items')
      .select('id, slug, title, image_url, status')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false })
      .limit(20),
  ])

  if (reviewsError) console.error('Reviews query error:', reviewsError)

  // Order pipeline items: testing first, then queued, then considering. Take top 3.
  const STATUS_RANK: Record<string, number> = { testing: 0, queued: 1, considering: 2 }
  const onDeck = (testingNow ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    .slice(0, 3)

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Hybrid hero: spotlight from top + linear top-down */}
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
          <p className="text-gray-300 text-base md:text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            Reviews, guides, and really cool stuff for Dads who show up every single day.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/reviews" className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors">
              Browse Reviews
            </Link>
            <Link href="/guides" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold rounded-2xl transition-colors">
              Browse Guides
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured Review ─────────────────────────────────────────────── */}
      {reviews && reviews.length > 0 && (
        <section className="relative">
         {/* Architectural top-rule — fades at edges, branded */}
         <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-600/50 to-transparent" />
         <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="flex items-stretch justify-between gap-4 mb-8">
            <div className="flex items-stretch gap-4">
              {/* Vertical accent rule next to header */}
              <div className="w-[3px] bg-orange-600 rounded-full" />
              <div>
                <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-2">Just In</p>
                <h2 className="text-2xl font-black text-white leading-tight">Most Recent Test</h2>
              </div>
            </div>
            <Link href="/reviews" className="hidden sm:inline-flex items-center self-end text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold">
              All Reviews
            </Link>
          </div>
          <Link
            href={`/reviews/${reviews[0].slug}`}
            className="group flex flex-col md:flex-row bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
          >
            {reviews[0].image_url && (
              <div className="relative w-full md:w-1/2 h-72 md:h-auto md:min-h-[380px] bg-gray-800 shrink-0">
                <Image
                  src={reviews[0].image_url}
                  alt={reviews[0].product_name}
                  fill
                  priority
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <span className="absolute top-4 left-4 bg-orange-600 text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-black/40">
                  Featured
                </span>
                {(reviews[0].rating ?? 0) >= 8 && (
                  <div className="absolute top-4 right-4">
                    <BossApprovedBadge size="sm" variant="card" />
                  </div>
                )}
              </div>
            )}
            <div className="p-8 md:p-10 flex flex-col flex-1 justify-center">
              <div className="flex items-center justify-between mb-4 gap-3">
                <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                  {reviews[0].product_name}
                </span>
                <RatingScore rating={reviews[0].rating ?? 0} />
              </div>
              <h3 className="text-2xl md:text-3xl font-black leading-tight mb-3 text-white group-hover:text-orange-400 transition-colors">
                {reviews[0].title}
              </h3>
              {reviews[0].excerpt && (
                <p className="text-gray-400 text-base leading-relaxed line-clamp-3">
                  {reviews[0].excerpt}
                </p>
              )}
              <div className="flex items-center justify-between mt-6 pt-4">
                <span className="text-sm text-gray-500">
                  {reviews[0].published_at ? new Date(reviews[0].published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
                <span className="text-sm text-orange-500 font-semibold">Read review</span>
              </div>
            </div>
          </Link>
         </div>
        </section>
      )}

      {/* ── Browse by Category ───────────────────────────────────────────── */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Browse by Category</p>
          <h2 className="text-2xl font-black mb-8">What kind of dad stuff are you into?</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.slug}
                href={`/reviews/category/${cat.slug}`}
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

      {/* ── On Deck — pipeline (testing / queued / considering) ───────────── */}
      {onDeck.length > 0 && (
        <section>
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-orange-500">On the Bench</span>
              </div>
              <Link href="/bench" className="text-xs text-gray-500 hover:text-orange-400 transition-colors font-medium">
                Vote on what&apos;s next
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide sm:overflow-visible sm:grid sm:grid-cols-3">
              {(onDeck as WishlistItem[]).map((item) => (
                <Link
                  key={item.id}
                  href={`/bench/${item.slug}`}
                  className="shrink-0 w-48 sm:w-auto flex items-center gap-3 p-3 bg-gray-900 hover:bg-gray-800 rounded-2xl shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 transition-all"
                >
                  <div className="relative w-10 h-10 shrink-0 rounded-2xl overflow-hidden bg-gray-950">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.title} fill className="object-contain p-1" sizes="40px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </p>
                    <p className="text-xs font-semibold text-gray-300 line-clamp-2 leading-snug">{item.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Latest Guides ───────────────────────────────────────────────── */}
      <Suspense fallback={<LatestArticlesSkeleton />}>
        <LatestGuidesSection />
      </Suspense>

      {/* ── More Reviews (grid) ──────────────────────────────────────────── */}
      <section>
       <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-black text-white">More Reviews</h2>
            <p className="text-gray-500 text-sm mt-1">Bought, tested, and Boss Daddy Approved</p>
          </div>
          <Link href="/reviews" className="text-sm text-orange-400 hover:text-orange-300 transition-colors">
            View all
          </Link>
        </div>

        {!reviews?.length || reviews.length < 2 ? (
          <div className="text-center py-20 rounded-2xl">
            <p className="text-gray-600">More reviews dropping soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {reviews.slice(1, 7).map((r, i) => (
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
                          priority={i < 2}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        {/* Magazine-TOC index number */}
                        <span className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-orange-400 text-[10px] font-bold tracking-[0.2em] tabular-nums">
                          {String(i + 1).padStart(2, '0')}
                        </span>
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
                          {r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                        </span>
                        <span className="text-xs text-orange-500 font-medium">Read review</span>
                      </div>
                    </div>
                  </Link>
                ))}
          </div>
        )}
       </div>
      </section>

      {/* ── Shop Teaser ───────────────────────────────────────────────────── */}
      <section>
       <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-xl shadow-black/40 px-8 py-10">

          {/* Product image strip — horizontal, centered */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            {reviews
              ?.filter((r) => r.image_url)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 6)
              .map((r) => (
                <div key={r.id} className="relative w-full aspect-square rounded-2xl overflow-hidden bg-gray-800">
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
              <h2 className="text-2xl font-black text-white mb-2">The Good Stuff</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Every product we&apos;ve tested and actually stand behind — all in one place.
              </p>
            </div>
            <Link
              href="/reviews"
              className="shrink-0 px-8 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl transition-colors"
            >
              Shop the List
            </Link>
          </div>

        </div>
       </div>
      </section>

      {/* ── Join the Crew / Newsletter ────────────────────────────────────── */}
      <section id="crew" className="max-w-6xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-br from-orange-950/40 to-gray-900 rounded-2xl shadow-xl shadow-black/40 px-8 py-12 text-center max-w-2xl mx-auto">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Join the Boss Daddy Crew
          </p>
          <h2 className="text-2xl font-black text-white mb-3">
            Real Talk. Honest Reviews.<br />No BS Ever.
          </h2>
          <p className="text-gray-400 mb-8">
            Weekly reviews, the good stuff, and dad-life wins from a real dad in the trenches.
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

      {/* ── Closing Tagline ───────────────────────────────────────────────── */}
      <section className="relative py-24 md:py-32">
        {/* Hairline rule above */}
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

function LatestArticlesSkeleton() {
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
