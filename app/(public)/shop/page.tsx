import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Shop — Boss Daddy Life',
  description: 'Every product Boss Daddy has tested and actually recommends. Sorted by rating.',
}


interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ShopPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('rating', { ascending: false })
    .order('published_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data: reviews } = await query

  const topPicks = reviews?.filter(r => r.rating >= 8) ?? []
  const cat = category ? getCategoryBySlug(category) : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          Dad-Tested Gear Only
        </div>
        <h1 className="text-3xl font-black mb-2">
          {cat ? `${cat.icon} ${cat.label} Gear` : 'The Boss Daddy Gear List'}
        </h1>
        <p className="text-gray-500 text-sm">
          {topPicks.length} picks rated 8.0 or higher — sorted by rating
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide mb-10 pb-1">
        <Link
          href="/shop"
          className={`shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium transition-colors ${
            !category
              ? 'bg-orange-600 text-white'
              : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
          }`}
        >
          All Gear
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/shop?category=${c.slug}`}
            className={`shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium transition-colors ${
              category === c.slug
                ? 'bg-orange-600 text-white'
                : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            {c.icon} {c.label}
          </Link>
        ))}
      </div>

      {/* Gear grid */}
      {!topPicks.length ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-600 text-lg">No gear here yet.</p>
          <p className="text-gray-700 text-sm mt-2">Reviews are being added.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((r) => {
            const reviewCat = getCategoryBySlug(r.category)
            return (
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
                  </div>
                ) : (
                  <div className="w-full h-44 bg-gray-800/50 flex items-center justify-center shrink-0">
                    <span className="text-4xl">{reviewCat?.icon ?? '📦'}</span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                      {r.product_name}
                    </span>
                    <RatingScore rating={r.rating} />
                  </div>
                  <h2 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {r.title}
                  </h2>
                  {r.excerpt && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <span className="text-xs text-orange-500 font-medium">Read full review →</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
