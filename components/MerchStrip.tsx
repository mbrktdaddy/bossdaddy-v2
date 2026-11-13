import Image from 'next/image'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { formatPrice, getMerchDisplayImage, type Merch } from '@/lib/merch'
import { BRAND } from '@/lib/brand'
import { BagIcon } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'

/**
 * MerchStrip — slim, proud "Made by Boss Daddy" strip, the store's discovery
 * surface. The store itself is /shop (split out of /gear 2026-09-29); this
 * strip rides on /gear and /about so readers find the merch without a fifth
 * nav anchor (the homepage and the articles use the light `MerchCallout`).
 * "Shop →" goes to /shop.
 * Two states: a few live/coming-soon items as a horizontal scroll strip, or a
 * tight branded teaser when nothing is loaded yet (a brand moment on a brand
 * page; the article form, `MerchCallout`, disappears instead).
 *
 * Settled 2026-11-13 with the callout: the same headline (the merch voice
 * line), "Shop →" as a button, featured items first, the same tile anatomy
 * (image, status badge, name, price). Its own tile rather than the shared
 * card because the card is a light-surface card and would sit as a dark box
 * on this black panel. It left the homepage 2026-11-13: after the About band
 * it stacked a third dark band on About + the footer, and anywhere higher it
 * either broke the content-first order or touched the Tools panels — so the
 * homepage keeps the slot (the Creed, then "rep the brand") in the light form.
 */
/**
 * @param exploreHref where "Shop →", the empty state, and the no-link
 *   fallback point. Defaults to /shop.
 */
export async function MerchStrip({ exploreHref = '/shop' }: { exploreHref?: string } = {}) {
  // Cookie-free anon client — public merch only; keeps host pages static (audit H3).
  const supabase = createAnonClient()

  const { data } = await supabase
    .from('merch')
    .select('id, name, slug, image_url, default_image_url, price_cents, status, position, external_url, printful_sync_product_id')
    .in('status', ['coming_soon', 'available'])
    .is('archived_at', null)
    .order('featured', { ascending: false })
    .order('position', { ascending: true })
    .limit(6)

  const products = (data ?? []) as Merch[]

  return (
    <section data-theme="dark" className="my-12 bg-chrome text-prose border-t-4 border-accent rounded-xl px-6 py-8">
      <div className="flex items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <LabelBlock tone="accent" className="mb-2">Made by Boss Daddy</LabelBlock>
          <h2 className="text-xl font-black text-prose leading-tight">{BRAND.merchVoice}</h2>
        </div>
        <Link href={exploreHref} className={buttonVariants({ variant: 'primary', size: 'sm', className: 'shrink-0' })}>
          Shop →
        </Link>
      </div>

      {products.length === 0 ? (
        <Link href={exploreHref} className="block">
          <p className="text-sm text-prose-muted leading-relaxed">
            Branded apparel, drinkware &amp; accessories — built for the dads who get it done.{' '}
            <span className="text-accent-text font-semibold">First drop coming soon →</span>
          </p>
        </Link>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
          {products.map((p) => {
            const img = getMerchDisplayImage(p as Parameters<typeof getMerchDisplayImage>[0]) ?? p.image_url
            const href = p.printful_sync_product_id != null
              ? `/shop/${p.slug}`
              : (p.external_url ?? exploreHref)
            const isExternal = p.printful_sync_product_id == null && Boolean(p.external_url)
            const inner = (
              <>
                <div className="relative w-36 h-36 overflow-hidden rounded-xl bg-surface-sunken border-b-[3px] border-chrome">
                  {img ? (
                    <Image src={img} alt="" /* decorative: the link's text already names it — an alt here gets read twice */ fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="144px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BagIcon className="w-9 h-9 text-prose-faint" strokeWidth={1} aria-hidden />
                    </div>
                  )}
                  {p.status !== 'available' && (
                    <Badge tone="neutral" size="sm" className="absolute top-2 left-2">Coming soon</Badge>
                  )}
                </div>
                <p className="text-xs font-semibold text-prose mt-2 w-36 truncate group-hover:text-accent-text transition-colors">{p.name}</p>
                <p className="text-xs font-bold tabular-nums text-prose mt-0.5">{p.price_cents != null ? formatPrice(p.price_cents) : '—'}</p>
              </>
            )
            return isExternal ? (
              <a key={p.id} href={href} target="_blank" rel="noopener" className="group shrink-0">{inner}</a>
            ) : (
              <Link key={p.id} href={href} className="group shrink-0">{inner}</Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
