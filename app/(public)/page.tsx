import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Boss Daddy — Dad-Tested Product Reviews',
  description: 'Honest, dad-tested product reviews. No corporate fluff — real results from a real dad.',
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
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <span className="text-orange-500 font-bold text-xl">Boss Daddy</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/login" className="text-gray-400 hover:text-white transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 leading-tight">
          Dad-Tested.<br />
          <span className="text-orange-500">Boss-Approved.</span>
        </h1>
        <p className="text-gray-400 text-lg">
          No corporate fluff. No paid placements. Just real results from a real dad who actually tests this stuff.
        </p>
      </section>

      {/* Reviews grid */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        {!reviews?.length ? (
          <p className="text-center text-gray-600">Reviews coming soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-orange-800 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">{r.product_name}</span>
                  <span className="text-yellow-400 text-sm">{'★'.repeat(r.rating)}</span>
                </div>
                <h2 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors">
                  {r.title}
                </h2>
                <p className="text-xs text-gray-600 mt-3">
                  {r.published_at ? new Date(r.published_at).toLocaleDateString() : ''}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
