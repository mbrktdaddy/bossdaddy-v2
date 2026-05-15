import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  reviewId: string
}

const TYPE_META: Record<string, { label: string; section: string; symbol: string }> = {
  general:    { label: 'Boss Picks',  section: '/picks',       symbol: '★' },
  best_of:    { label: 'Best Of',     section: '/picks',       symbol: '★' },
  comparison: { label: 'Comparison',  section: '/comparisons', symbol: '⚖' },
  stack:      { label: 'The Stack',   section: '/stacks',      symbol: '⛓' },
}

/**
 * Cross-link footer: shows every visible collection that features this review.
 * Renders nothing if there are none. Gift guides intentionally excluded
 * because they live at /gifts/[occasion-slug], not /gifts/[collection-slug].
 */
export default async function CollectionsForReview({ reviewId }: Props) {
  const supabase = await createClient()

  const { data: rawItems } = await supabase
    .from('collection_items')
    .select('collections!inner(id, slug, title, collection_type, is_visible)')
    .eq('review_id', reviewId)

  type CollectionRow = { id: string; slug: string; title: string; collection_type: string | null; is_visible: boolean }
  const collections: CollectionRow[] = []
  const seen = new Set<string>()
  for (const it of (rawItems ?? [])) {
    const c = it.collections as CollectionRow | CollectionRow[] | null
    const row = Array.isArray(c) ? c[0] : c
    if (!row || !row.is_visible) continue
    if (seen.has(row.id)) continue
    seen.add(row.id)
    if (row.collection_type === 'gift_guide') continue
    collections.push(row)
  }

  if (collections.length === 0) return null

  return (
    <section className="mt-12 pt-8 border-t border-gray-800/60" aria-label="Featured in collections">
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Featured in</p>
        <h2 className="text-lg font-black">Boss Daddy collections</h2>
      </div>
      <ul className="space-y-2">
        {collections.map((c) => {
          const meta = TYPE_META[c.collection_type ?? 'general'] ?? TYPE_META.general
          const href = `${meta.section}/${c.slug}`
          return (
            <li key={c.id}>
              <Link
                href={href}
                className="group flex items-center gap-4 p-4 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 hover:-translate-y-0.5 rounded-2xl shadow-md shadow-black/30 transition-all"
              >
                <span aria-hidden className="text-2xl text-orange-400 shrink-0 leading-none">{meta.symbol}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-orange-500 uppercase tracking-widest font-bold mb-0.5">{meta.label}</p>
                  <p className="text-sm sm:text-base font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-1">{c.title}</p>
                </div>
                <span aria-hidden className="text-gray-600 group-hover:text-orange-400 transition-colors text-xl shrink-0">→</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
