import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug, type CategorySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import { MerchPanel } from './_components/MerchPanel'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Approved Gear — Field-Tested Picks',
  description: 'Every product Boss Daddy has personally bought, tested, and stands behind — sorted by rating. The only gear list where every pick is earned, not sponsored. Plus branded goods, made by a real dad.',
  openGraph: {
    title: 'Boss Daddy Approved Gear — Boss Daddy Life',
    description: 'Every product personally bought, tested, and rated. Field-tested by a real dad. And, soon, made by one.',
    images: [{ url: '/api/og?title=Boss+Daddy+Approved+Gear&type=review', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Boss Daddy Approved Gear — Boss Daddy Life',
  },
  alternates: { canonical: '/gear' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function GearPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .gte('rating', 8)
    .order('rating', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(120)

  if (category) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query = query.eq('category', category as any)
  }

  const { data: reviews } = await query
  const topPicks = reviews ?? []
  const cat = category ? getCategoryBySlug(category) : null

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">

      {/* Page header — eyebrow + h1 + subtitle */}
      <div className="mb-12">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Dad-Tested Gear Only</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">
          {cat ? `${cat.icon} ${cat.label} Gear` : 'Boss Daddy Approved Gear'}
        </h1>
        <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-2xl">
          Field-tested by a real dad. <span className="text-gray-500">And, soon, made by one.</span>
        </p>
        <p className="text-gray-500 text-sm tabular-nums mt-3">
          {topPicks.length} {topPicks.length === 1 ? 'pick' : 'picks'} rated 8.0 or higher — sorted by rating
        </p>
      </div>

      {/* Category filter pills */}
      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-10">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/gear"
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
              !category
                ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40'
            }`}
          >
            All Gear
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/gear?category=${c.slug}`}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                category === c.slug
                  ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40'
              }`}
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── Featured: Made by Boss Daddy (merch panel) ─────────────────── */}
      <MerchPanel />

      {/* ── Field-Tested gear grid ─────────────────────────────────────── */}
      <div className="flex items-stretch gap-4 mb-6 mt-14">
        <div className="w-[3px] bg-orange-600 rounded-full" />
        <div>
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">— Field Tested</p>
          <h2 className="text-2xl font-black text-white leading-tight">What I Actually Use</h2>
        </div>
      </div>

      {!topPicks.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">No gear here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Reviews are being added.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {topPicks.map((r) => {
            const reviewCat = getCategoryBySlug(r.category)
            return (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
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
                    <RatingScore rating={r.rating ?? 0} />
                  </div>
                  <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                    {r.title}
                  </h3>
                  {r.excerpt && (
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                  )}
                  <div className="mt-4 pt-4">
                    <span className="text-xs text-orange-500 font-medium">Read full review</span>
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
