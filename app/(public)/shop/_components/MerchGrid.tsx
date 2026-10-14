import Image from 'next/image'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { EmailSignup } from '@/components/EmailSignup'
import { CAPTURE_CARD } from '@/components/NewsletterCard'
import { formatPrice, getMerchDisplayImage, type Merch } from '@/lib/merch'

/**
 * MerchGrid — the /shop catalog (was MerchPanel, a section on /gear before the
 * store split out on 2026-09-29).
 *
 * Two states:
 *   - Empty (no merch live yet): tight callout + inline email capture
 *   - Live (>=1 product available or coming_soon): 3-up grid
 */
export async function MerchGrid() {
  const supabase = createAnonClient() // cookie-free: public merch only (audit H3)

  const { data } = await supabase
    .from('merch')
    .select('id, name, slug, description, image_url, default_image_url, price_cents, status, category, position, external_url, printful_sync_product_id')
    .in('status', ['coming_soon', 'available'])
    .is('archived_at', null)
    .order('position', { ascending: true })

  const products = (data ?? []) as Merch[]
  const isEmpty = products.length === 0

  return (
    <section>
        {isEmpty ? (
          /* Empty state — tight callout + email capture */
          <div className={CAPTURE_CARD}>
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
                  <div className="relative w-full aspect-square bg-surface-raised rounded-xl overflow-hidden">
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
                        <svg className="w-12 h-12 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                    )}
                    {!isAvailable && (
                      <span className="absolute top-3 left-3 bg-chrome text-white rounded-sm px-2 py-1 text-[10px] font-display font-black uppercase tracking-[0.14em]">Coming soon</span>
                    )}
                  </div>
                  <div className="pt-4 flex flex-col flex-1">
                    <h3 className="text-base font-extrabold text-prose leading-snug mb-1.5 group-hover:text-accent transition-colors">
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

              const className = 'group flex flex-col'

              // Printful products → internal detail page
              if (isPrintful) {
                return (
                  <Link key={p.id} href={`/shop/${p.slug}`} className={className}>
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
    </section>
  )
}
