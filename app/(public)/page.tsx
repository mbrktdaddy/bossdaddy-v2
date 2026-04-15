import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Boss Daddy — Dad-Tested Product Reviews',
  description: 'Honest, dad-tested product reviews. No corporate fluff — real results from a real dad.',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400' : 'text-gray-700'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

export default async function HomePage() {
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, rating, published_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
    .limit(12)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Sticky Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-orange-500 font-black text-xl tracking-tight">BOSS DADDY</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <Link href="/" className="hover:text-white transition-colors">Reviews</Link>
            <Link href="/affiliate-disclosure" className="hover:text-white transition-colors">Disclosure</Link>
          </nav>

          <Link
            href="/login"
            className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-orange-600 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-gray-800/60">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-950/30 via-transparent to-transparent pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Dad-tested. No BS.
              </div>

              <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-6">
                Reviews Built
                <br />
                <span className="text-orange-500">In the Trenches.</span>
              </h1>

              <p className="text-gray-400 text-lg md:text-xl leading-relaxed mb-8 max-w-xl">
                No paid placements. No affiliate pressure. Just a dad who buys the stuff,
                breaks it, fixes it, and tells you the truth.
              </p>

              <div className="flex items-center gap-4">
                <Link
                  href="#reviews"
                  className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Browse Reviews
                </Link>
                <Link
                  href="/register"
                  className="px-6 py-3 text-gray-300 hover:text-white font-medium transition-colors"
                >
                  Write a Review →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Bar ─────────────────────────────────────────────────── */}
        <section className="border-b border-gray-800/60 bg-gray-900/40">
          <div className="max-w-6xl mx-auto px-6 py-5">
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Honest testing
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-500">✓</span> FTC-compliant disclosures
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-500">✓</span> No sponsored content
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Dad-verified results
              </span>
            </div>
          </div>
        </section>

        {/* ── Reviews Grid ──────────────────────────────────────────────── */}
        <section id="reviews" className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">Latest Reviews</h2>
              <p className="text-gray-500 text-sm mt-1">All bought, tested, and approved by the Boss</p>
            </div>
          </div>

          {!reviews?.length ? (
            <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-gray-600 text-lg">Reviews dropping soon.</p>
              <p className="text-gray-700 text-sm mt-2">Check back, Boss.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {reviews.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-700/60 hover:bg-gray-900/80 transition-all duration-200"
                >
                  {/* Category + Rating */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full">
                      {r.product_name}
                    </span>
                    <StarRating rating={r.rating} />
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {r.title}
                  </h3>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800">
                    <span className="text-xs text-gray-600">
                      {r.published_at
                        ? new Date(r.published_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : ''}
                    </span>
                    <span className="text-xs text-orange-500 font-medium group-hover:translate-x-0.5 transition-transform">
                      Read review →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

      </main>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800/60 bg-gray-900/30">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <span className="font-black text-gray-500 tracking-tight">BOSS DADDY</span>
          <div className="flex items-center gap-6">
            <Link href="/affiliate-disclosure" className="hover:text-gray-400 transition-colors">
              Affiliate Disclosure
            </Link>
            <Link href="/login" className="hover:text-gray-400 transition-colors">
              Sign In
            </Link>
          </div>
          <span>© {new Date().getFullYear()} Boss Daddy. All rights reserved.</span>
        </div>
      </footer>

    </div>
  )
}
