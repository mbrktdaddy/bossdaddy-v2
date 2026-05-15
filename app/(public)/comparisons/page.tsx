import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Comparisons — Head-to-Head Reviews | Boss Daddy',
  description: 'Dad-tested head-to-head matchups. Real products, real scores, one clear winner per dimension.',
  alternates: { canonical: '/comparisons' },
}

export default async function ComparisonsIndexPage() {
  const supabase = await createClient()
  const { data: comparisons } = await supabase
    .from('collections')
    .select('id, slug, title, description, hero_image_url, published_at')
    .eq('is_visible', true)
    .eq('collection_type', 'comparison')
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Comparisons</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight">Head-to-Head</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed">
          When two or three products solve the same problem and you can&apos;t decide. Real testing, scorecards across the four dimensions, a winner per category, one clear bottom line.
        </p>
      </div>

      {!comparisons?.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">First matchup dropping soon.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(comparisons ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/comparisons/${c.slug}`}
              className="group flex flex-col bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-gray-800 shrink-0">
                {c.hero_image_url ? (
                  <Image
                    src={c.hero_image_url}
                    alt={c.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-4xl">⚖️</span>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-orange-600 text-white">
                    Head-to-Head
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-white group-hover:text-orange-400 transition-colors leading-snug mb-2">
                  {c.title}
                </h2>
                {c.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">{c.description}</p>
                )}
                <p className="text-xs text-orange-500 font-semibold mt-4">See the scorecard →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
