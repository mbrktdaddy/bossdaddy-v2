import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCollectionsWithCategory } from '@/lib/collection-listings'
import CategoryFilterPills from '@/components/collections/CategoryFilterPills'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Comparisons — Head-to-Head Reviews | Boss Daddy',
  description: 'Dad-tested head-to-head matchups. Real products, real scores, one clear winner per dimension.',
  alternates: { canonical: '/comparisons' },
  openGraph: {
    title: 'Comparisons | Boss Daddy',
    description: 'Dad-tested head-to-head matchups. Real products, real scores, one clear winner per dimension.',
    images: [{ url: '/api/og?title=Head-to-Head+Comparisons&type=guide', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function ComparisonsIndexPage({ searchParams }: Props) {
  const { cat: catParam } = await searchParams
  const supabase = await createClient()
  const all = await getCollectionsWithCategory(supabase, ['comparison'])

  // Build per-category counts before filtering so the pills always reflect
  // the full catalog (otherwise pills would shrink as you filter).
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
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Comparisons</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight">Head-to-Head</h1>
        <p className="text-prose-muted max-w-2xl leading-relaxed">
          When two or three products solve the same problem and you can&apos;t decide. Real testing, scorecards across the four dimensions, a winner per category, one clear bottom line.
        </p>
      </div>

      <CategoryFilterPills basePath="/comparisons" active={active} counts={counts} total={all.length} />

      {filtered.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl">
          <p className="text-prose-faint text-lg font-semibold">
            {active ? 'No matchups in this category yet.' : 'First matchup dropping soon.'}
          </p>
          <p className="text-prose-faint text-sm mt-2">
            {active ? <Link href="/comparisons" className="text-accent-text-soft hover:text-accent">See all comparisons →</Link> : 'Check back soon, Boss.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/comparisons/${c.slug}`}
              className="group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/50 hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-surface-raised shrink-0">
                {c.hero_image_url ? (
                  <Image
                    src={c.hero_image_url}
                    alt={c.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-surface-raised">
                    <svg className="w-10 h-10 text-accent-text/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-accent text-white">
                    Head-to-Head
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-2">
                  {c.title}
                </h2>
                {c.description && (
                  <p className="text-sm text-prose-faint line-clamp-2 leading-relaxed flex-1">{c.description}</p>
                )}
                <p className="text-xs text-accent-text font-semibold mt-4">See the scorecard →</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-16">
        <BenchStrip ctaText="See all on the bench" />
      </div>
    </div>
  )
}
