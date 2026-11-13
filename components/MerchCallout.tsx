import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { type Merch } from '@/lib/merch'
import { BRAND } from '@/lib/brand'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'
import { FeaturedMerchCard } from './FeaturedMerchCard'

/**
 * MerchCallout — the ARTICLE form of the merch module (reviews, guides): light,
 * under a hairline, after the bench head, so it stays quiet inside the close.
 * The brand-page form is `MerchStrip` (black, on /gear and /about); the homepage
 * uses THIS form after the About band — the Creed, then "rep the brand" — because
 * a black strip there stacked a third dark band on About and the footer.
 * Settled 2026-11-13 so the two
 * agree on everything but the surface: the merch voice line as the headline,
 * "Shop →" as a button, featured items first, the same tile anatomy (image,
 * status badge, name, price). Self-suppresses at zero items — a teaser is a
 * brand moment on a brand page and noise on an article.
 */
export async function MerchCallout({
  /** The article margins by default; a page container (the homepage) passes its own. */
  className = 'mt-12 pt-10 border-t border-soft',
}: { className?: string } = {}) {
  // Cookie-free anon client — public merch only (audit H3).
  const supabase = createAnonClient()
  // Featured items lead, then the rest of the catalog by position. This used to
  // filter to featured-only, so with nothing flagged the callout rendered null on
  // every review and guide, and the store had no presence on the pages people read.
  const { data } = await supabase
    .from('merch')
    .select('id, slug, name, image_url, default_image_url, price_cents, status, printful_sync_product_id, external_url, position')
    .in('status', ['available', 'coming_soon'])
    .is('archived_at', null)
    .order('featured', { ascending: false })
    .order('position', { ascending: true })
    .limit(3)

  const items = (data ?? []) as Merch[]
  if (items.length === 0) return null

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3 mb-6">
        <div className="min-w-0">
          <LabelBlock className="mb-2">Made by Boss Daddy</LabelBlock>
          <h3 className="text-lg font-black text-prose leading-tight">{BRAND.merchVoice}</h3>
        </div>
        <Link href="/shop" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'shrink-0' })}>
          Shop →
        </Link>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden -mx-6">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-3 px-6 pb-2" style={{ width: 'max-content' }}>
            {items.map((item) => (
              <div key={item.id} className="w-44 shrink-0">
                <FeaturedMerchCard item={item} compact />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop: 3-col grid */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        {items.map((item) => (
          <FeaturedMerchCard key={item.id} item={item} compact />
        ))}
      </div>
    </div>
  )
}
