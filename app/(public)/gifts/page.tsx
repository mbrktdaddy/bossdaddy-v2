import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OCCASIONS, OCCASION_GROUPS } from '@/lib/gift-occasions'
import OccasionIcon from '@/components/OccasionIcon'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Gift Guides — Dad-Tested Picks for Every Occasion',
  description: 'Honest gift guides for every holiday and occasion — Father\'s Day, Christmas, birthdays, weddings, and more. Every pick personally tested by a real dad.',
  alternates: { canonical: '/gifts' },
  openGraph: {
    title: 'Gift Guides — Boss Daddy Life',
    description: 'Honest gift guides for every occasion. Every pick dad-tested.',
  },
}

export default async function GiftsIndexPage() {
  const supabase = await createClient()

  // Find which occasions have published gift guides so we can show status
  // indicators. A guide only counts as "live" once it has at least one pick —
  // an empty collection still reads as "Coming Soon", matching the detail page
  // empty state. We pull the item count inline to avoid an N+1 per occasion.
  const { data: liveGifts } = await supabase
    .from('collections')
    .select('occasion, slug, title, hero_image_url, published_at, collection_items(count)')
    .eq('collection_type', 'gift_guide')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })

  const liveByOccasion = new Map<string, { slug: string; title: string; hero_image_url: string | null; populated: boolean }>()
  for (const g of (liveGifts ?? [])) {
    // Keep the latest published collection per occasion (rows arrive newest
    // first), mirroring the detail page's single-collection selection.
    if (g.occasion && !liveByOccasion.has(g.occasion)) {
      const count = Array.isArray(g.collection_items) ? (g.collection_items[0]?.count ?? 0) : 0
      liveByOccasion.set(g.occasion, {
        slug: g.slug,
        title: g.title,
        hero_image_url: g.hero_image_url ?? null,
        populated: count > 0,
      })
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">The Gift Vault</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight">Gift Guides</h1>
        <p className="text-prose-muted max-w-2xl leading-relaxed text-base md:text-lg">
          Real-tested gift guides for every holiday, milestone, and occasion. Each list curated from a dad who actually buys, tests, and lives with this stuff. No corporate gift-list filler.
        </p>
      </div>

      {/* Grouped occasion grid */}
      {OCCASION_GROUPS.map((group) => (
        <section key={group.id} className="mb-14">
          <div className="mb-6">
            <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{group.label}</p>
            <h2 className="text-2xl font-black text-prose">{group.label}</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {OCCASIONS.filter((o) => o.group === group.id).map((occ) => {
              const guide = liveByOccasion.get(occ.value)
              const populated = guide?.populated ?? false
              return (
                <Link
                  key={occ.value}
                  href={`/gifts/${occ.slug}`}
                  className="group flex flex-col bg-surface border border-soft hover:bg-surface-raised/90 hover:border-accent-border/40 hover:-translate-y-1 rounded-xl overflow-hidden shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/10 transition-all"
                >
                  <div className="relative aspect-[4/3] bg-surface-sunken flex items-center justify-center">
                    {guide?.hero_image_url ? (
                      <Image
                        src={guide.hero_image_url}
                        alt={occ.label}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <OccasionIcon value={occ.value} className="w-12 h-12 text-accent-text/70" />
                    )}
                    <div className="absolute top-2 right-2">
                      {populated ? (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-accent text-white">
                          Live
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-chrome/80 text-prose-faint border border-soft backdrop-blur-sm">
                          Coming Soon
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-1">
                      {occ.label}
                    </p>
                    <p className="text-xs text-prose-faint leading-relaxed line-clamp-2 flex-1">
                      {occ.shortBlurb}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      {/* Newsletter pitch */}
      <div className="mt-16 pt-10 border-t border-soft text-center max-w-2xl mx-auto">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3 mx-auto" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Stay in the loop</p>
        <h3 className="text-xl font-black text-prose mb-2">New gift guides drop with the seasons</h3>
        <p className="text-sm text-prose-muted mb-4">
          Subscribe to the Boss Daddy Crew for fresh gift picks before each major holiday.
        </p>
        <Link
          href="/#newsletter"
          className="inline-block px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-colors min-h-[44px]"
        >
          Get on the list →
        </Link>
      </div>
    </div>
  )
}
