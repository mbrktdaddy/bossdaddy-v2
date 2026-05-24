import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getCollectionsWithCategory } from '@/lib/collection-listings'
import CategoryFilterPills from '@/components/collections/CategoryFilterPills'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Stacks — Dad-Tested Kits | Boss Daddy',
  description: 'Curated kits for a goal. The full setup for newborn nights, weekend cookouts, garage builds, and more.',
  alternates: { canonical: '/stacks' },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function StacksIndexPage({ searchParams }: Props) {
  const { cat: catParam } = await searchParams
  const supabase = await createClient()
  const all = await getCollectionsWithCategory(supabase, ['stack'])

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
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Stacks</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight">The Kit For The Job</h1>
        <p className="text-prose-muted max-w-2xl leading-relaxed">
          Curated kits for a specific goal. The newborn-night setup. The weekend cookout. The first-apartment toolbox. Each piece earned its spot, no fluff.
        </p>
      </div>

      <CategoryFilterPills basePath="/stacks" active={active} counts={counts} total={all.length} />

      {filtered.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl">
          <p className="text-prose-faint text-lg font-semibold">
            {active ? 'No stacks in this category yet.' : 'First stack dropping soon.'}
          </p>
          <p className="text-prose-faint text-sm mt-2">
            {active ? <Link href="/stacks" className="text-accent-text-soft hover:text-accent">See all stacks →</Link> : 'Check back soon, Boss.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/stacks/${s.slug}`}
              className="group flex flex-col bg-gradient-to-br from-surface to-surface/60 border border-soft ring-1 ring-inset ring-stone-900/[0.04] rounded-xl overflow-hidden shadow-lg shadow-stone-900/[0.06] hover:shadow-xl hover:shadow-stone-900/[0.10] hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-surface-raised shrink-0">
                {s.hero_image_url ? (
                  <Image
                    src={s.hero_image_url}
                    alt={s.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-raised/40 to-surface/60">
                    <svg className="w-10 h-10 text-accent-text/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-accent text-white">
                    The Stack
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-2">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="text-sm text-prose-faint line-clamp-2 leading-relaxed flex-1">{s.description}</p>
                )}
                <p className="text-xs text-accent-text font-semibold mt-4">Build the stack →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
