import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OCCASIONS, OCCASION_GROUPS, getOccasionByValue } from '@/lib/gift-occasions'

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

  // Find which occasions have published gift guides so we can show "live" indicators
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: liveGifts } = await (supabase as any)
    .from('pick_lists')
    .select('occasion, slug, title, hero_image_url, published_at')
    .eq('pick_type', 'gift_guide')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })

  type LiveGift = { occasion: string | null; slug: string; title: string; hero_image_url: string | null }
  const liveByOccasion = new Map<string, { slug: string; title: string; hero_image_url: string | null }>()
  for (const g of ((liveGifts ?? []) as LiveGift[])) {
    if (g.occasion && !liveByOccasion.has(g.occasion)) {
      liveByOccasion.set(g.occasion, {
        slug: g.slug,
        title: g.title,
        hero_image_url: g.hero_image_url ?? null,
      })
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— The Gift Vault</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight">Gift Guides</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed text-base md:text-lg">
          Real-tested gift guides for every holiday, milestone, and occasion. Each list curated from a dad who actually buys, tests, and lives with this stuff. No corporate gift-list filler.
        </p>
      </div>

      {/* Grouped occasion grid */}
      {OCCASION_GROUPS.map((group) => (
        <section key={group.id} className="mb-14">
          <div className="flex items-stretch gap-4 mb-6">
            <div className="w-[3px] bg-orange-600 rounded-full" />
            <div>
              <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">— {group.label}</p>
              <h2 className="text-2xl font-black text-white">{group.label}</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {OCCASIONS.filter((o) => o.group === group.id).map((occ) => {
              const live = liveByOccasion.get(occ.value)
              return (
                <Link
                  key={occ.value}
                  href={`/gifts/${occ.slug}`}
                  className="group flex flex-col bg-gray-900 hover:bg-gray-800/90 rounded-2xl overflow-hidden shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/50 transition-all border border-gray-800"
                >
                  <div className="relative aspect-video bg-gray-950 flex items-center justify-center">
                    {live?.hero_image_url ? (
                      <Image
                        src={live.hero_image_url}
                        alt={occ.label}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      />
                    ) : (
                      <span className="text-5xl">{occ.emoji}</span>
                    )}
                    {live && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-600 text-white">
                          Live
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors leading-snug mb-1">
                      {occ.label}
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 flex-1">
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
      <div className="mt-16 pt-10 border-t border-gray-800/60 text-center max-w-2xl mx-auto">
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Stay in the loop</p>
        <h3 className="text-xl font-black text-white mb-2">New gift guides drop with the seasons</h3>
        <p className="text-sm text-gray-400 mb-4">
          Subscribe to the Boss Daddy Crew for fresh gift picks before each major holiday.
        </p>
        <Link
          href="/#newsletter"
          className="inline-block px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors min-h-[44px]"
        >
          Get on the list →
        </Link>
      </div>
    </div>
  )
}
