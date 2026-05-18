import Link from 'next/link'
import type { ProductBadge } from '@/lib/collection-listings'

interface Props {
  /** Pre-resolved badges from getBadgesByProductSlug. Listing pages batch-
   *  fetch once and slice per card to avoid N+1. */
  badges: ProductBadge[]
  /** Max chips to render. Default 2 — chip rows are dense, don't overflow
   *  card layouts. Pass 3 sparingly. */
  max?: number
  /** Compact variant — smaller padding and font, for tight rows like /reviews
   *  cards. Default chips use the standard size, suited to /gear cards. */
  compact?: boolean
}

const ICON_CLS = 'w-3 h-3 shrink-0'

// Same icon + label vocabulary as components/collections/RelatedRail.tsx so
// badges read as smaller Related cards rather than a new component family.
// Gift-guide intentionally omitted — the batch helper filters them out
// because their URL is keyed by occasion slug, not collection slug.
const TYPE_META: Record<string, { label: string; section: string; icon: React.ReactNode }> = {
  comparison: {
    label:   'Comparison',
    section: '/comparisons',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
  },
  best_of: {
    label:   'Best Of',
    section: '/picks',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  general: {
    label:   'Pick List',
    section: '/picks',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  stack: {
    label:   'Stack',
    section: '/stacks',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
}

export default function BadgesForProduct({ badges, max = 2, compact = false }: Props) {
  const visible = badges.slice(0, max)
  if (visible.length === 0) return null

  return (
    <ul
      aria-label="Featured in collections"
      className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}
    >
      {visible.map((b) => {
        const meta = TYPE_META[b.collection_type] ?? TYPE_META.general
        // Stop propagation so clicking a chip navigates to the collection
        // even when the card itself is a Link (e.g. /reviews/[slug]). Without
        // this the outer <Link>'s click handler wins and the chip's destination
        // is ignored.
        return (
          <li key={`${b.collection_type}:${b.slug}`} className="contents">
            <Link
              href={`${meta.section}/${b.slug}`}
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1.5 rounded-full bg-orange-950/40 border border-orange-900/40 hover:border-orange-700/60 hover:bg-orange-900/50 transition-colors group/badge ${
                compact
                  ? 'px-2 py-0.5 text-[10px]'
                  : 'px-2.5 py-1 text-[11px]'
              }`}
            >
              <span className="text-orange-400 group-hover/badge:text-orange-300 transition-colors">{meta.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400 group-hover/badge:text-orange-300 transition-colors">
                {meta.label}
              </span>
              <span className={`font-semibold text-gray-300 group-hover/badge:text-white transition-colors truncate max-w-[160px] ${compact ? '' : 'max-w-[200px]'}`}>
                {b.title}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
