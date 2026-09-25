'use client'

import Link from 'next/link'
import type { ProductBadge } from '@/lib/collection-listings'
import { LABELS } from '@/lib/labels'
import { CubeIcon, ScaleIcon, StarIcon } from '@/components/icons'

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
    label:   LABELS.comparisons.singular,
    section: '/comparisons',
    icon: (
      <ScaleIcon className={ICON_CLS} strokeWidth={1.5} />
    ),
  },
  best_of: {
    label:   LABELS.picks.singular,
    section: '/picks',
    icon: (
      <StarIcon className={ICON_CLS} strokeWidth={1.5} />
    ),
  },
  general: {
    label:   LABELS.picks.singular,
    section: '/picks',
    icon: (
      <StarIcon className={ICON_CLS} strokeWidth={1.5} />
    ),
  },
  stack: {
    label:   LABELS.stacks.singular,
    section: '/stacks',
    icon: (
      <CubeIcon className={ICON_CLS} strokeWidth={1.5} />
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
              className={`inline-flex items-center gap-1.5 rounded-full bg-accent-tint border border-accent-border/40 hover:border-accent-border/60 hover:bg-accent-tint transition-colors group/badge ${
                compact
                  ? 'px-2 py-0.5 text-[10px]'
                  : 'px-2.5 py-1 text-[11px]'
              }`}
            >
              <span className="text-accent-text-soft group-hover/badge:text-accent transition-colors">{meta.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-text-soft group-hover/badge:text-accent transition-colors">
                {meta.label}
              </span>
              <span className={`font-semibold text-prose-muted group-hover/badge:text-prose transition-colors truncate max-w-[160px] ${compact ? '' : 'max-w-[200px]'}`}>
                {b.title}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
