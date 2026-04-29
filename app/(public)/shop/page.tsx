import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { EmailSignup } from '@/components/EmailSignup'
import { SHOP_CATEGORIES, formatPrice, type ShopProduct } from '@/lib/shop'
import type { Metadata } from 'next'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Boss Daddy Shop — Branded Gear Coming Soon',
  description: 'Boss Daddy merch — apparel, drinkware, and accessories built for the dads who get it done. First drop coming soon.',
  openGraph: {
    title: 'Boss Daddy Shop — Branded Gear Coming Soon',
    description: 'Apparel, drinkware, and accessories built for the dads who get it done.',
    images: [{ url: '/api/og?title=Boss+Daddy+Shop&type=review', width: 1200, height: 630 }],
  },
  alternates: { canonical: '/shop' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function ShopPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('shop_products')
    .select('id, name, slug, description, image_url, price_cents, status, category, position, external_url')
    .in('status', ['coming_soon', 'available'])
    .order('position', { ascending: true })

  if (category) {
    query = query.eq('category', category)
  }

  const { data } = await query
  const products = (data ?? []) as ShopProduct[]

  const hasAvailable = products.some((p) => p.status === 'available')
  const allComingSoon = !hasAvailable && products.length > 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">

      {/* Hero */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          {hasAvailable ? 'Now shipping' : 'First drop coming soon'}
        </div>
        <h1 className="text-4xl sm:text-5xl font-black mb-4 tracking-tight">
          Boss Daddy <span className="text-orange-500">Shop</span>
        </h1>
        <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto">
          Apparel, drinkware, and accessories built for dads who get it done. No fluff. No fast fashion. Just gear that lasts.
        </p>
      </div>

      {/* Email capture (top, prominent when nothing's live yet) */}
      {allComingSoon && (
        <div className="mb-12 max-w-xl mx-auto bg-gradient-to-br from-gray-900 to-gray-950 border border-orange-900/30 rounded-2xl p-6">
          <EmailSignup
            heading="Get first dibs"
            description="We'll let you know the second the first drop goes live. No spam — just a single launch email and you're in."
            buttonLabel="Notify me"
            successMessage="You're on the list. First drop, you'll be the first to know."
            interests={['shop_launch']}
          />
        </div>
      )}

      {/* Category filter tabs */}
      {products.length > 0 && (
        <div className="-mx-6 overflow-x-auto scrollbar-hide mb-10">
          <div className="flex items-center gap-2 px-6 pb-1 justify-center">
            <Link
              href="/shop"
              className={`shrink-0 whitespace-nowrap px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                !category
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
              }`}
            >
              All
            </Link>
            {SHOP_CATEGORIES.filter((c) => c.slug !== 'other').map((c) => (
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
        </div>
      )}

      {/* Product grid */}
      {products.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
          <p className="text-gray-600 text-lg">Nothing here yet.</p>
          <p className="text-gray-700 text-sm mt-2">Check back soon — first drop is being put together.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((p) => {
            const isComingSoon = p.status === 'coming_soon'
            const isAvailable = p.status === 'available'
            const cardInner = (
              <>
                <div className="relative w-full aspect-square bg-gray-800/40">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-6xl opacity-40">
                        {SHOP_CATEGORIES.find((c) => c.slug === p.category)?.icon ?? '📦'}
                      </span>
                    </div>
                  )}
                  {isComingSoon && (
                    <div className="absolute top-3 left-3 bg-orange-950/90 border border-orange-800/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
                      <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Coming soon</p>
                    </div>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h2 className="text-base font-semibold leading-snug mb-1.5 group-hover:text-orange-400 transition-colors">
                    {p.name}
                  </h2>
                  {p.description && (
                    <p className="text-gray-500 text-sm line-clamp-2 mb-3 flex-1">{p.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                    <span className="text-orange-500 font-bold text-sm">
                      {p.price_cents != null ? formatPrice(p.price_cents) : '—'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAvailable ? 'Buy →' : 'Notify me →'}
                    </span>
                  </div>
                </div>
              </>
            )

            const className = 'group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200'

            if (isAvailable && p.external_url) {
              return (
                <a
                  key={p.id}
                  href={p.external_url}
                  target="_blank"
                  rel="noopener"
                  className={className}
                >
                  {cardInner}
                </a>
              )
            }

            return (
              <div key={p.id} className={className}>
                {cardInner}
              </div>
            )
          })}
        </div>
      )}

      {/* In the meantime → /gear callout */}
      <div className="mt-16 bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 text-center">
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">In the meantime</p>
        <h3 className="text-xl font-black mb-2">See what Boss Daddy actually uses</h3>
        <p className="text-gray-400 text-sm mb-5 max-w-md mx-auto">
          Every product I've personally tested and stand behind — the gear list. No paid placements.
        </p>
        <Link
          href="/gear"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Browse the gear list →
        </Link>
      </div>

      {/* Bottom email capture (when products exist but most are coming soon) */}
      {products.length > 0 && !allComingSoon && (
        <div className="mt-12 max-w-xl mx-auto">
          <EmailSignup
            heading="Stay in the loop"
            description="New drops, restocks, and one-time discounts — straight to your inbox."
            buttonLabel="Sign me up"
            interests={['shop_launch']}
          />
        </div>
      )}
    </div>
  )
}
