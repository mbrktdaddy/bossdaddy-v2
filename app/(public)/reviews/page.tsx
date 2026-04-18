import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryLabel, getCategoryBySlug } from '@/lib/categories'
import Pagination from '@/components/Pagination'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import type { Metadata } from 'next'

export const revalidate = 3600

const PER_PAGE = 12

export const metadata: Metadata = {
  title: 'All Reviews',
  description: 'Browse all dad-tested, honestly-rated product reviews from Boss Daddy Life.',
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

interface Props {
  searchParams: Promise<{ category?: string; page?: string }>
}

export default async function ReviewsPage({ searchParams }: Props) {
  const { category, page: pageParam } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1', 10))
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1
  const supabase = await createClient()

  let query = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .range(from, to)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: reviews, count } = await query

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl font-black mb-2">
            {category ? getCategoryLabel(category) : 'All Reviews'}
          </h1>
          <p className="text-gray-500">
            {reviews?.length ?? 0} dad-tested {reviews?.length === 1 ? 'review' : 'reviews'}
            {category ? ` in ${getCategoryLabel(category)}` : ''}
          </p>
        </div>

        {/* Category filter tabs */}
        <div className="flex items-center gap-2 flex-wrap mb-10">
          <Link
            href="/reviews"
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !category
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews?category=${c.slug}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                category === c.slug
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>

        {/* Reviews grid */}
        {!reviews?.length ? (
          <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-600 text-lg">No reviews here yet.</p>
            <p className="text-gray-700 text-sm mt-2">Check back soon, Boss.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
              >
                {r.image_url ? (
                  <div className="relative w-full h-44 bg-gray-800 shrink-0">
                    <Image
                      src={r.image_url}
                      alt={r.product_name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    {r.rating === 5 && (
                      <div className="absolute top-3 right-3">
                        <BossApprovedBadge size="sm" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`w-full h-44 shrink-0 bg-gradient-to-br ${
                    getCategoryBySlug(r.category ?? '')?.color ?? 'from-gray-800 to-gray-900'
                  } flex items-center justify-center`}>
                    <span className="text-4xl opacity-40">
                      {getCategoryBySlug(r.category ?? '')?.icon ?? '📦'}
                    </span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
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

      <Pagination
        page={page}
        total={count ?? 0}
        perPage={PER_PAGE}
        basePath="/reviews"
        params={category ? { category } : {}}
      />
    </div>
  )
}
