import Image from 'next/image'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'
import { BagIcon } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, getMerchDisplayImage, type Merch } from '@/lib/merch'

/**
 * MerchGrid — the /shop catalog (was MerchPanel, a section on /gear before the
 * store split out on 2026-09-29).
 *
 * Two states:
 *   - Empty (no merch live yet): the notify capture card (never the digest)
 *   - Live (>=1 product available or coming_soon): 2-up phone / 3-up desktop grid
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
          /* Empty state — a NOTIFY capture. intent="notify" tags `notify:shop:launch`
             and never the digest, so "tell me when the first drop lands" doesn't
             silently enrol anyone in the weekly email (B5). */
          <NewsletterSignup
            variant="card"
            intent="notify"
            topic="shop:launch"
            eyebrow="Coming soon"
            heading="The first drop is on the way"
            body="Branded gear — apparel, drinkware, and accessories built for the dads who get it done. Get notified when the first drop lands."
            successMessage="You're on the list. We'll email you when the first drop lands."
          />
        ) : (
          /* Live state — 3-up grid */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 sm:gap-x-5">
            {products.map((p) => {
              const isAvailable = p.status === 'available'
              const isPrintful = p.printful_sync_product_id != null
              const displayImage = getMerchDisplayImage(p as Parameters<typeof getMerchDisplayImage>[0]) ?? p.image_url
              const inner = (
                <>
                  <div className="relative w-full aspect-square bg-surface-sunken border-b-[3px] border-chrome rounded-xl overflow-hidden">
                    {displayImage ? (
                      <Image
                        src={displayImage}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BagIcon className="w-12 h-12 text-prose-faint" strokeWidth={1} aria-hidden />
                      </div>
                    )}
                    {!isAvailable && (
                      <Badge tone="neutral" size="sm" className="absolute top-2 left-2">Coming soon</Badge>
                    )}
                  </div>
                  <div className="pt-3 flex flex-col flex-1">
                    <h3 className="text-sm sm:text-base font-extrabold text-prose leading-snug mb-1.5 group-hover:text-accent transition-colors">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-prose-faint text-sm line-clamp-2 mb-2 flex-1">{p.description}</p>
                    )}
                    <p className="text-prose font-bold text-sm tabular-nums pt-1">
                      {p.price_cents != null ? formatPrice(p.price_cents) : '—'}
                    </p>

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
