import Link from 'next/link'
import Image from 'next/image'
import { OCCASIONS } from '@/lib/gift-occasions'

interface Collection {
  slug: string
  title: string
  description: string | null
  hero_image_url: string | null
  collection_type: string
  occasion?: string | null
}

interface Props {
  col: Collection
}

const TYPE_LABELS: Record<string, string> = {
  comparison: 'Comparison',
  best_of:    'Best Of',
  general:    'Pick List',
  stack:      'Stack',
  gift_guide: 'Gift Guide',
}

/**
 * Routes gift_guide collections to /gifts/[occasion]/[slug] when the
 * collection has a known occasion, falling back to /gifts. Other types
 * route to their dedicated landing path. Mirrors the original homepage's
 * vaultHrefFor logic — preserved during the design migration.
 */
function hrefFor(col: Collection): string {
  if (col.collection_type === 'gift_guide') {
    if (!col.occasion) return '/gifts'
    const occ = OCCASIONS.find((o) => o.value === col.occasion)
    return occ ? `/gifts/${occ.slug}` : '/gifts'
  }
  if (col.collection_type === 'comparison') return `/comparisons/${col.slug}`
  if (col.collection_type === 'stack')      return `/stacks/${col.slug}`
  return `/picks/${col.slug}`
}

/**
 * Collection card with structural dark top strip + brand-orange eyebrow.
 * The 4px zinc-900 strip is a structural rule, not a per-type color
 * signal — type identity lives in the orange dot + label. This is the
 * brand-disciplined treatment that replaced the per-type rainbow
 * (blue/purple/cyan/red) prior to the migration.
 */
export default function VaultCard({ col }: Props) {
  const typeLabel = TYPE_LABELS[col.collection_type] ?? 'Collection'

  return (
    <Link
      href={hrefFor(col)}
      className="group flex flex-col bg-surface border border-soft rounded-2xl overflow-hidden shadow-md shadow-black/[0.04] hover:shadow-lg hover:shadow-black/[0.08] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="h-1 bg-drama" />
      <div className="relative h-40 bg-surface-raised">
        {col.hero_image_url && (
          <Image
            src={col.hero_image_url}
            alt={col.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="inline-flex items-center gap-1.5 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          <span className="text-[10px] font-extrabold text-accent uppercase tracking-[0.16em]">
            {typeLabel}
          </span>
        </div>
        <h3 className="text-[15px] font-extrabold text-prose leading-snug mb-2 group-hover:text-accent transition-colors">
          {col.title}
        </h3>
        {col.description && (
          <p className="text-xs text-prose-muted leading-relaxed line-clamp-2">
            {col.description}
          </p>
        )}
      </div>
    </Link>
  )
}
