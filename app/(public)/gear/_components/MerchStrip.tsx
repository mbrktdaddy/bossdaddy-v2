import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getMerchDisplayImage, type Merch } from '@/lib/merch'

/**
 * MerchStrip — slim, proud "Made by Boss Daddy" strip woven high on /gear
 * (right after the #1 Pick), so branded merch rides alongside the top picks
 * instead of being buried. "Explore →" jumps to the fuller MerchPanel (#merch)
 * lower on the page. Two states: a few live/coming-soon items as a scroll
 * strip, or a tight branded teaser when nothing is loaded yet.
 */
export async function MerchStrip() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('merch')
    .select('id, name, slug, image_url, default_image_url, status, position, external_url, printful_sync_product_id')
    .in('status', ['coming_soon', 'available'])
    .is('archived_at', null)
    .order('position', { ascending: true })
    .limit(6)

  const products = (data ?? []) as Merch[]

  return (
    <section className="relative my-12">
      {/* Branded top-rule — same architectural cue as the full MerchPanel */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
      <div className="pt-8">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="flex items-stretch gap-3">
            <div className="w-[3px] bg-accent-brand rounded-full" />
            <div>
              <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-0.5">— Made by Boss Daddy</p>
              <h2 className="text-xl font-black text-prose leading-tight">Boss Daddy Merch</h2>
            </div>
          </div>
          <a href="#merch" className="text-sm text-accent-text font-semibold hover:text-accent-text-soft transition-colors shrink-0">
            Explore →
          </a>
        </div>

        {products.length === 0 ? (
          <a
            href="#merch"
            className="block bg-surface border border-soft rounded-xl px-5 py-4 hover:border-accent-border/40 transition-colors"
          >
            <p className="text-sm text-prose-muted leading-relaxed">
              Branded apparel, drinkware &amp; accessories — built for the dads who get it done.{' '}
              <span className="text-accent-text font-semibold">First drop coming soon →</span>
            </p>
          </a>
        ) : (
          <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
            {products.map((p) => {
              const img = getMerchDisplayImage(p as Parameters<typeof getMerchDisplayImage>[0]) ?? p.image_url
              const href = p.printful_sync_product_id != null
                ? `/gear/${p.slug}`
                : (p.external_url ?? '#merch')
              const isExternal = p.printful_sync_product_id == null && Boolean(p.external_url)
              const inner = (
                <>
                  <div className="relative w-36 h-36 rounded-xl overflow-hidden bg-surface-raised border border-soft">
                    {img ? (
                      <Image src={img} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="144px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-9 h-9 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                        </svg>
                      </div>
                    )}
                    {p.status !== 'available' && (
                      <span className="absolute top-2 left-2 bg-accent-tint/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-bold text-accent-text-soft uppercase tracking-widest">
                        Soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-prose mt-2 w-36 truncate group-hover:text-accent-text-soft transition-colors">{p.name}</p>
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
      </div>
    </section>
  )
}
