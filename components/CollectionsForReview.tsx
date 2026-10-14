import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { vaultHref, vaultTypeLabel } from '@/lib/vault'
import SectionHeader from '@/components/SectionHeader'
import { CubeIcon, ScaleIcon, StarIcon } from '@/components/icons'

interface Props {
  reviewId: string
}

// Outlined SVG icons per the no-emoji-on-web brand rule. star → Pick / Best Of,
// scales → Comparison, stacked-rectangles → Stack.
const ICON_CLS = 'w-5 h-5 shrink-0'

const ICONS = {
  star: (
    <StarIcon className={ICON_CLS} strokeWidth={1.5} />
  ),
  scales: (
    <ScaleIcon className={ICON_CLS} strokeWidth={1.5} />
  ),
  stack: (
    <CubeIcon className={ICON_CLS} strokeWidth={1.5} />
  ),
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  general:    ICONS.star,
  best_of:    ICONS.star,
  comparison: ICONS.scales,
  stack:      ICONS.stack,
}

/**
 * Cross-link footer: shows every visible collection that features this review.
 * Renders nothing if there are none. Gift guides intentionally excluded
 * because they live at /gifts/[occasion-slug], not /gifts/[collection-slug].
 */
export default async function CollectionsForReview({ reviewId }: Props) {
  // Cookie-free anon client — reads only visible public collections; keeps the
  // host page statically prerenderable (audit H3).
  const supabase = createAnonClient()

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
    <section className="mt-12 pt-8 border-t border-soft" aria-label="Featured in collections">
      {/* No hub link: the Vault stopped being a place (Phase I-4). Each row
          below links its own listing's detail page. */}
      <SectionHeader label="Featured in" heading="Collections" />
      <ul>
        {collections.map((c) => {
          const icon = TYPE_ICONS[c.collection_type ?? 'general'] ?? TYPE_ICONS.general
          const href = vaultHref({ collection_type: c.collection_type, slug: c.slug })
          return (
            <li key={c.id}>
              <Link
                href={href}
                className="group flex items-center gap-4 py-4 border-t border-soft transition-colors"
              >
                <span className="text-prose shrink-0">{icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-bold mb-0.5">{vaultTypeLabel(c.collection_type)}</p>
                  <p className="text-sm sm:text-base font-bold text-prose group-hover:text-accent transition-colors line-clamp-1">{c.title}</p>
                </div>
                <span aria-hidden className="text-prose-faint group-hover:text-accent transition-colors text-xl shrink-0">→</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
