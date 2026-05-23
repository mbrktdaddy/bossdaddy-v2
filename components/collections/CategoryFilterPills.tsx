import Link from 'next/link'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'

interface Props {
  /** Base path the pills link back to — e.g. '/comparisons'. */
  basePath: string
  /** Currently active category slug, or null when "All" is selected. */
  active:   string | null
  /** Map of slug → count, so we can show counts per pill and hide empties. */
  counts:   Map<string, number>
  /** Total count across all categories (rendered on the "All" pill). */
  total:    number
}

/**
 * Server-rendered category filter strip for collection listing pages.
 * Uses URL query params (?cat=<slug>) for state so filters are
 * deep-linkable / shareable / SEO-indexable. Renders only categories
 * that actually have at least one collection — keeps the strip tight
 * as the catalog grows.
 *
 * Active pill is solid orange; idle pills are dark with a hairline.
 * Mobile: horizontal scroll. Desktop: wraps naturally.
 */
export default function CategoryFilterPills({ basePath, active, counts, total }: Props) {
  // Only show pills for categories that have at least one matching collection.
  // Source order = CATEGORIES order (lib/categories.ts) for stable layout.
  const visible = CATEGORIES.filter((c) => (counts.get(c.slug) ?? 0) > 0)
  if (visible.length === 0) return null

  return (
    <nav aria-label="Filter by category" className="mb-8 -mx-6 px-6">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="shrink-0 text-[10px] font-bold text-eyebrow uppercase tracking-widest mr-1">
          Filter
        </span>
        <FilterPill href={basePath} label="All" count={total} active={!active} />
        {visible.map((c) => (
          <FilterPill
            key={c.slug}
            href={`${basePath}?cat=${c.slug}`}
            label={c.shortLabel}
            count={counts.get(c.slug) ?? 0}
            active={active === c.slug}
          />
        ))}
      </div>
      {active && (
        <p className="mt-3 text-xs text-prose-faint">
          Showing collections tagged <code className="text-accent-text-soft/80">{getCategoryBySlug(active)?.label ?? active}</code> ·{' '}
          <Link href={basePath} className="text-accent-text-soft hover:text-accent font-semibold transition-colors">
            Clear filter
          </Link>
        </p>
      )}
    </nav>
  )
}

function FilterPill({
  href,
  label,
  count,
  active,
}: {
  href:   string
  label:  string
  count:  number
  active: boolean
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition-colors min-h-[44px] ${
        active
          ? 'bg-accent text-white border-accent'
          : 'bg-surface text-prose-muted border-soft hover:border-strong hover:text-prose'
      }`}
    >
      {label}
      <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
        active ? 'bg-orange-700 text-orange-100' : 'bg-surface-raised text-prose-faint'
      }`}>
        {count}
      </span>
    </Link>
  )
}
