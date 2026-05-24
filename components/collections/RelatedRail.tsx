import Link from 'next/link'
import Image from 'next/image'

export type RelatedCollectionType = 'comparison' | 'general' | 'best_of' | 'stack' | 'gift_guide'

export interface RelatedItem {
  slug:            string
  title:           string
  description:     string | null
  hero_image_url:  string | null
  collection_type: RelatedCollectionType | string | null
}

interface Props {
  items:   RelatedItem[]
  heading?: string
  eyebrow?: string
  /** Section anchor id — referenced by ArticleTOC. */
  id?:     string
}

/**
 * "Also worth a look" rail. Renders 3-up on desktop, horizontal scroll on
 * mobile. Each card carries a small type pill (Comparison / Stack / Pick /
 * Gift Guide) so readers can tell at a glance whether they're heading to
 * a head-to-head, a curated list, or a kit-for-purpose article.
 *
 * Designed for the BOTTOM of any collection detail page — keeps the reader
 * inside the editorial loop instead of bouncing off to search.
 */
export default function RelatedRail({
  items,
  heading = 'Keep going',
  eyebrow = 'Related from the Vault',
  id = 'related',
}: Props) {
  if (!items || items.length === 0) return null

  return (
    <section id={id} aria-label={heading} className="mt-14 pt-10 border-t border-soft">
      <div className="mb-6">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{eyebrow}</p>
        <h2 className="text-2xl font-black text-prose leading-tight">{heading}</h2>
      </div>

      {/* Mobile: horizontal scroll strip */}
      <div className="sm:hidden -mx-6 px-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {items.map((item) => (
            <RelatedCard key={item.slug + (item.collection_type ?? '')} item={item} className="shrink-0 w-64" />
          ))}
        </div>
      </div>

      {/* Desktop: 3-up grid */}
      <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <RelatedCard key={item.slug + (item.collection_type ?? '')} item={item} />
        ))}
      </div>
    </section>
  )
}

function RelatedCard({ item, className }: { item: RelatedItem; className?: string }) {
  const meta = TYPE_META[item.collection_type ?? 'general'] ?? TYPE_META.general
  const href = `${meta.section}/${item.slug}`
  return (
    <Link
      href={href}
      className={`group flex flex-col bg-gradient-to-br from-surface to-surface/60 border border-soft rounded-xl overflow-hidden shadow-md shadow-black/30 hover:border-accent-border/40 hover:shadow-lg hover:shadow-black/50 hover:-translate-y-1 transition-all ${className ?? ''}`}
    >
      <div className="relative aspect-video bg-surface-sunken">
        {item.hero_image_url ? (
          <Image src={item.hero_image_url} alt={item.title} fill className="object-cover" sizes="(max-width: 640px) 256px, (max-width: 1024px) 50vw, 33vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-accent-text/30">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
            </svg>
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-surface-sunken/85 backdrop-blur border border-soft rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-text-soft">
          {meta.icon}
          {meta.label}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug line-clamp-2 mb-1">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-prose-faint line-clamp-2 leading-relaxed flex-1">{item.description}</p>
        )}
        <p className="mt-3 text-[10px] text-prose-faint uppercase tracking-widest font-semibold group-hover:text-accent-text-soft transition-colors">
          Read →
        </p>
      </div>
    </Link>
  )
}

const ICON_CLS = 'w-3 h-3 shrink-0'

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
  gift_guide: {
    label:   'Gift Guide',
    section: '/gifts',
    icon: (
      <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
}
