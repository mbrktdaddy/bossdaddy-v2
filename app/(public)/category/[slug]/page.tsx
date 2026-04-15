import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Category Not Found' }
  return {
    title: `${cat.label} Reviews`,
    description: cat.description,
  }
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

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = await createClient()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, rating, excerpt, published_at')
    .eq('status', 'approved')
    .eq('category', slug)
    .order('published_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-black text-xl tracking-tight">
            <span className="text-orange-500">BOSS</span><span className="text-white"> DADDY</span>
          </Link>
          <Link href="/login" className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-orange-600 hover:text-white transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* Category hero */}
      <div className={`bg-gradient-to-br ${cat.color} border-b border-gray-800/60`}>
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="text-5xl mb-4">{cat.icon}</div>
          <h1 className={`text-4xl font-black mb-3 ${cat.accent}`}>{cat.label}</h1>
          <p className="text-gray-400 text-lg max-w-xl">{cat.description}</p>
          <p className="text-sm text-gray-600 mt-3">
            {reviews?.length ?? 0} {reviews?.length === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/reviews" className="text-sm text-gray-500 hover:text-white transition-colors">← All Reviews</Link>
        </div>

        {!reviews?.length ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-lg">No {cat.label} reviews yet.</p>
            <p className="text-gray-700 text-sm mt-2">Gear is being tested. Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-orange-700/60 transition-all duration-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full">
                    {r.product_name}
                  </span>
                  <StarRating rating={r.rating} />
                </div>
                <h2 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                  {r.title}
                </h2>
                {r.excerpt && (
                  <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                )}
                <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-800">
                  <span className="text-xs text-gray-600">
                    {r.published_at ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                  </span>
                  <span className="text-xs text-orange-500 font-medium">Read review →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
