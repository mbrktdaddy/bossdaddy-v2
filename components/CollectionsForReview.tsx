import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface Props {
  reviewId: string
}

// Outlined SVG icons per the no-emoji-on-web brand rule. star → Pick / Best Of,
// scales → Comparison, stacked-rectangles → Stack.
const ICON_CLS = 'w-5 h-5 shrink-0'

const ICONS = {
  star: (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  scales: (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  ),
  stack: (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
}

const TYPE_META: Record<string, { label: string; section: string; icon: React.ReactNode }> = {
  general:    { label: 'Boss Picks',  section: '/picks',       icon: ICONS.star },
  best_of:    { label: 'Best Of',     section: '/picks',       icon: ICONS.star },
  comparison: { label: 'Comparison',  section: '/comparisons', icon: ICONS.scales },
  stack:      { label: 'The Stack',   section: '/stacks',      icon: ICONS.stack },
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
    <section className="mt-12 pt-8 border-t border-soft/60" aria-label="Featured in collections">
      <div className="mb-5">
        <span aria-hidden className="block h-px w-6 bg-accent/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Featured in</p>
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
                className="group flex items-center gap-4 p-4 bg-gradient-to-br from-surface to-surface/60 border border-soft/60 ring-1 ring-inset ring-white/[0.02] hover:border-accent-border/40 hover:-translate-y-0.5 rounded-2xl shadow-md shadow-black/30 transition-all"
              >
                <span className="text-accent-text-soft shrink-0">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-bold mb-0.5">{meta.label}</p>
                  <p className="text-sm sm:text-base font-bold text-white group-hover:text-accent-text-soft transition-colors line-clamp-1">{c.title}</p>
                </div>
                <span aria-hidden className="text-prose-faint group-hover:text-accent-text-soft transition-colors text-xl shrink-0">→</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
