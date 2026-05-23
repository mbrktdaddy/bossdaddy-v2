import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { type Merch } from '@/lib/merch'
import { FeaturedMerchCard } from './FeaturedMerchCard'

export async function HomepageMerchStrip() {
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
    <section className="relative">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-end justify-between mb-8">
          <div className="flex items-stretch gap-4">
            <div className="w-[3px] bg-accent-brand rounded-full" />
            <div>
              <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— Rep the Brand</p>
              <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">Boss Daddy Gear</h2>
            </div>
          </div>
          <Link
            href="/gear"
            className="hidden sm:inline-flex items-center text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold"
          >
            Shop All Gear →
          </Link>
        </div>

        {/* Mobile: horizontal scroll strip — break out of px-6 padding */}
        <div className="sm:hidden -mx-6">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-4 px-6 pb-2" style={{ width: 'max-content' }}>
              {items.map((item) => (
                <div key={item.id} className="w-52 shrink-0">
                  <FeaturedMerchCard item={item} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop: 3-col grid */}
        <div className="hidden sm:grid sm:grid-cols-3 gap-5">
          {items.map((item) => (
            <FeaturedMerchCard key={item.id} item={item} />
          ))}
        </div>

        <div className="mt-6 sm:hidden text-center">
          <Link
            href="/gear"
            className="text-sm text-accent-text-soft hover:text-accent font-semibold transition-colors"
          >
            Shop All Gear →
          </Link>
        </div>
      </div>
    </section>
  )
}
