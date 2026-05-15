import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Boss Daddy Picks — Curated Gear Lists',
  description: 'Dad-tested gift guides and curated gear lists. Every pick is personally bought, tested, and recommended by Boss Daddy.',
  alternates: { canonical: '/picks' },
}

export default async function PicksIndexPage() {
  const supabase = await createClient()
  const { data: picks } = await supabase
    .from('pick_lists')
    .select('id, slug, title, description, hero_image_url, published_at, pick_type')
    .eq('is_visible', true)
    .neq('pick_type', 'gift_guide')
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">The Picks</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight">Boss Daddy Picks</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed">
          Curated gear lists from a dad who actually buys, tests, and lives with this stuff. Gift guides, best-of roundups, and category deep-dives.
        </p>
      </div>

      {!picks?.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">First list dropping soon.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(picks ?? []).map((pick) => (
            <Link
              key={pick.id}
              href={`/picks/${pick.slug}`}
              className="group flex flex-col bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-gray-800 shrink-0">
                {pick.hero_image_url ? (
                  <Image
                    src={pick.hero_image_url}
                    alt={pick.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl">🏆</span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-orange-600 text-white">
                    Boss Picks
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-white group-hover:text-orange-400 transition-colors leading-snug mb-2">
                  {pick.title}
                </h2>
                {pick.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">{pick.description}</p>
                )}
                <p className="text-xs text-orange-500 font-semibold mt-4">View picks →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
