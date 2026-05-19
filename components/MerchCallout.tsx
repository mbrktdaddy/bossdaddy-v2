import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { type Merch } from '@/lib/merch'
import { FeaturedMerchCard } from './FeaturedMerchCard'

export async function MerchCallout() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('merch')
    .select('id, slug, name, image_url, default_image_url, price_cents, status, printful_sync_product_id, external_url, position')
    .eq('featured', true)
    .in('status', ['available', 'coming_soon'])
    .is('archived_at', null)
    .order('position', { ascending: true })
    .limit(3)

  const items = (data ?? []) as Merch[]
  if (items.length === 0) return null

  return (
    <div className="mt-12 pt-10 border-t border-soft/60">
      <div className="flex items-end justify-between mb-6">
        <div>
          <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-1">— Boss Daddy Gear</p>
          <h3 className="text-lg font-black text-white">Rep the brand while you&apos;re at it.</h3>
        </div>
        <Link
          href="/gear"
          className="hidden sm:inline-flex text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold whitespace-nowrap ml-4"
        >
          Shop All →
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

      <div className="mt-5 sm:hidden text-center">
        <Link href="/gear" className="text-sm text-accent-text-soft hover:text-orange-300 font-semibold transition-colors">
          Shop All Gear →
        </Link>
      </div>
    </div>
  )
}
