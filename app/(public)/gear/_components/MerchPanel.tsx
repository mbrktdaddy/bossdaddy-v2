import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { EmailSignup } from '@/components/EmailSignup'
import { SHOP_CATEGORIES, formatPrice, type ShopProduct } from '@/lib/shop'

/**
 * MerchPanel — featured "Made by Boss Daddy" section on the unified /gear page.
 * Sits between the category filter and the gear grid.
 *
 * Two states:
 *   - Empty (no merch live yet): tight callout + inline email capture
 *   - Live (>=1 product available or coming_soon): 3-up grid
 */
export async function MerchPanel() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('shop_products')
    .select('id, name, slug, description, image_url, price_cents, status, category, position, external_url')
    .in('status', ['coming_soon', 'available'])
    .order('position', { ascending: true })
    .limit(3)

  const products = (data ?? []) as ShopProduct[]
  const isEmpty = products.length === 0

  return (
    <section className="relative my-14">
      {/* Architectural top-rule — fades at edges, branded */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-600/50 to-transparent" />

      <div className="pt-12">
        {/* Section opener — vertical orange rule + eyebrow + h2 */}
        <div className="flex items-stretch gap-4 mb-6">
          <div className="w-[3px] bg-orange-600 rounded-full" />
          <div>
            <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">— Made by Boss Daddy</p>
            <h2 className="text-2xl font-black text-white leading-tight">Boss Daddy Goods</h2>
          </div>
        </div>

        {isEmpty ? (
          /* Empty state — tight callout + email capture */
          <div className="bg-gray-900 rounded-2xl shadow-lg shadow-black/40 px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-base text-gray-300 leading-relaxed">
                  Branded gear, coming soon — apparel, drinkware, and accessories built for the dads who get it done.
                  Get notified when the first drop lands.
                </p>
              </div>
              <div className="sm:max-w-xs sm:w-full">
                <EmailSignup
                  heading={null}
                  description={null}
                  buttonLabel="Notify me"
                  successMessage="You're on the list."
                  interests={['shop_launch']}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Live state — 3-up grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => {
              const isAvailable = p.status === 'available'
              const inner = (
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
                    {!isAvailable && (
                      <div className="absolute top-3 left-3 bg-orange-950/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md shadow-black/40">
                        <p className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Coming soon</p>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-semibold leading-snug mb-1.5 group-hover:text-orange-400 transition-colors">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-gray-500 text-sm line-clamp-2 mb-3 flex-1">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-orange-500 font-bold text-sm">
                        {p.price_cents != null ? formatPrice(p.price_cents) : '—'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {isAvailable ? 'Buy' : 'Notify me'}
                      </span>
                    </div>
                  </div>
                </>
              )

              const className = 'group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200'

              if (isAvailable && p.external_url) {
                return (
                  <a key={p.id} href={p.external_url} target="_blank" rel="noopener" className={className}>
                    {inner}
                  </a>
                )
              }
              return (
                <div key={p.id} className={className}>
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
