import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCollectionsWithCategory } from '@/lib/collection-listings'
import CategoryFilterPills from '@/components/collections/CategoryFilterPills'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Boss Daddy Picks — Curated Gear Lists',
  description: 'Dad-tested gift guides and curated gear lists. Every pick is personally bought, tested, and recommended by Boss Daddy.',
  alternates: { canonical: '/picks' },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function PicksIndexPage({ searchParams }: Props) {
  const { cat: catParam } = await searchParams
  const supabase = await createClient()
  const all = await getCollectionsWithCategory(supabase, ['general', 'best_of'])

  const counts = new Map<string, number>()
  for (const c of all) {
    if (c.dominant_category) counts.set(c.dominant_category, (counts.get(c.dominant_category) ?? 0) + 1)
  }

  const filtered = catParam ? all.filter((c) => c.dominant_category === catParam) : all
  const active = catParam ?? null

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-10">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">The Picks</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight">Boss Daddy Picks</h1>
        <p className="text-prose-muted max-w-2xl leading-relaxed">
          Curated gear lists from a dad who actually buys, tests, and lives with this stuff. Gift guides, best-of roundups, and category deep-dives.
        </p>
      </div>

      <CategoryFilterPills basePath="/picks" active={active} counts={counts} total={all.length} />

      {filtered.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl">
          <p className="text-prose-faint text-lg font-semibold">
            {active ? 'No picks in this category yet.' : 'First list dropping soon.'}
          </p>
          <p className="text-prose-faint text-sm mt-2">
            {active ? <Link href="/picks" className="text-accent-text-soft hover:text-accent">See all picks →</Link> : 'Check back soon, Boss.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((pick) => (
            <Link
              key={pick.id}
              href={`/picks/${pick.slug}`}
              className="group flex flex-col bg-gradient-to-br from-surface to-surface/60 border border-soft ring-1 ring-inset ring-stone-900/[0.04] rounded-xl overflow-hidden shadow-lg shadow-stone-900/[0.06] hover:shadow-xl hover:shadow-stone-900/[0.10] hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-surface-raised shrink-0">
                {pick.hero_image_url ? (
                  <Image
                    src={pick.hero_image_url}
                    alt={pick.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-raised/40 to-surface/60">
                    <svg className="w-10 h-10 text-accent-text/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h12" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-accent text-white">
                    Boss Picks
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-2">
                  {pick.title}
                </h2>
                {pick.description && (
                  <p className="text-sm text-prose-faint line-clamp-2 leading-relaxed flex-1">{pick.description}</p>
                )}
                <p className="text-xs text-accent-text font-semibold mt-4">View picks →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
