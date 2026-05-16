import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Stacks — Dad-Tested Kits | Boss Daddy',
  description: 'Curated kits for a goal. The full setup for newborn nights, weekend cookouts, garage builds, and more.',
  alternates: { canonical: '/stacks' },
}

export default async function StacksIndexPage() {
  const supabase = await createClient()
  const { data: stacks } = await supabase
    .from('collections')
    .select('id, slug, title, description, hero_image_url, published_at')
    .eq('is_visible', true)
    .eq('collection_type', 'stack')
    .order('published_at', { ascending: false })

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Stacks</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight">The Kit For The Job</h1>
        <p className="text-gray-400 max-w-2xl leading-relaxed">
          Curated kits for a specific goal. The newborn-night setup. The weekend cookout. The first-apartment toolbox. Each piece earned its spot, no fluff.
        </p>
      </div>

      {!stacks?.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">First stack dropping soon.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(stacks ?? []).map((s) => (
            <Link
              key={s.id}
              href={`/stacks/${s.slug}`}
              className="group flex flex-col bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative w-full aspect-video bg-gray-800 shrink-0">
                {s.hero_image_url ? (
                  <Image
                    src={s.hero_image_url}
                    alt={s.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800/40 to-gray-900/60">
                    <svg className="w-10 h-10 text-orange-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="absolute top-3 left-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-orange-600 text-white">
                    The Stack
                  </span>
                </div>
              </div>
              <div className="p-5 flex flex-col flex-1">
                <h2 className="text-base font-black text-white group-hover:text-orange-400 transition-colors leading-snug mb-2">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed flex-1">{s.description}</p>
                )}
                <p className="text-xs text-orange-500 font-semibold mt-4">Build the stack →</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
