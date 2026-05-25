import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EmailSignup } from '@/components/EmailSignup'
import { formatPrice, getMerchDisplayImage, type Merch } from '@/lib/merch'

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
    .from('merch')
    .select('id, name, slug, description, image_url, default_image_url, price_cents, status, category, position, external_url, printful_sync_product_id')
    .in('status', ['coming_soon', 'available'])
    .is('archived_at', null)
    .order('position', { ascending: true })

  const products = (data ?? []) as Merch[]
  const isEmpty = products.length === 0

  return (
    <section className="relative my-14">
      {/* Architectural top-rule — fades at edges, branded */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-600/50 to-transparent" />

      <div className="pt-12">
        {/* Section opener — vertical orange rule + eyebrow + h2 */}
        <div className="flex items-stretch gap-4 mb-6">
          <div className="w-[3px] bg-accent-brand rounded-full" />
          <div>
            <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-1">— Made by Boss Daddy</p>
            <h2 className="text-2xl font-black text-prose leading-tight">Boss Daddy Merch</h2>
          </div>
        </div>

        {isEmpty ? (
          /* Empty state — tight callout + email capture */
          <div className="bg-surface rounded-xl shadow-lg shadow-black/30 px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-center gap-6">
              <div className="flex-1">
                <p className="text-base text-prose-muted leading-relaxed">
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
              const isPrintful = p.printful_sync_product_id != null
              const displayImage = getMerchDisplayImage(p as Parameters<typeof getMerchDisplayImage>[0]) ?? p.image_url
              const inner = (
                <>
                  <div className="relative w-full aspect-square bg-surface-raised/40">
                    {displayImage ? (
                      <Image
                        src={displayImage}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-12 h-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                    )}
                    {!isAvailable && (
                      <div className="absolute top-3 left-3 bg-accent-tint/90 backdrop-blur-sm px-2.5 py-1 rounded-full shadow-md shadow-black/30">
                        <p className="text-[10px] font-bold text-accent-text-soft uppercase tracking-widest">Coming soon</p>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-semibold leading-snug mb-1.5 group-hover:text-accent-text-soft transition-colors">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-prose-faint text-sm line-clamp-2 mb-3 flex-1">{p.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-accent-text font-bold text-sm">
                        {p.price_cents != null ? formatPrice(p.price_cents) : '—'}
                      </span>
                      <span className="text-xs text-prose-faint">
                        {isAvailable ? 'Buy' : 'Notify me'}
                      </span>
                    </div>
                  </div>
                </>
              )

              const className = 'group flex flex-col bg-surface rounded-xl overflow-hidden shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/50 transition-all duration-200'

              // Printful products → internal detail page
              if (isPrintful) {
                return (
                  <Link key={p.id} href={`/gear/${p.slug}`} className={className}>
                    {inner}
                  </Link>
                )
              }
              // Manual products with external link
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
