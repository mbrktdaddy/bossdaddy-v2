import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'

interface Guide {
  id: string
  slug: string
  title: string
  category: string | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  reading_time_minutes: number | null
}

/**
 * Medium-weight guide card — a 3-up grid cell. Shaped like VaultCard (h-40 image,
 * dot + eyebrow, 2-line clamp) so guide and collection grids read as one card
 * language. Distinct from FeaturedGuideCard, which is a large horizontal split
 * built for the /guides listing hero and carries its own `mb-20`.
 *
 * Used by the `/guides/category/[slug]` grid, which previously inlined a near-copy
 * of this markup carrying `shadow-lg shadow-black/5` — shadows that are invisible
 * on a near-black canvas. Elevation here is border + hover lift only.
 *
 * `on` names the surface the card sits ON, and therefore picks the card's own
 * background: a `bg-surface` card inside a `bg-surface` section is invisible except
 * for its border, and a `bg-background` card on a plain page background is the same
 * bug in reverse. Same prop, same reason, as LeadCard.
 */
export default function LibraryGuideCard({
  guide: g,
  on = 'surface',
}: { guide: Guide; on?: 'background' | 'surface' }) {
  const cat = g.category ? getCategoryBySlug(g.category) : null

  return (
    <Link
      href={`/guides/${g.slug}`}
      className={`group flex flex-col border border-soft rounded-2xl overflow-hidden hover:border-accent hover:-translate-y-0.5 transition-all duration-200 ${
        on === 'surface' ? 'bg-background' : 'bg-surface'
      }`}
    >
      <div className="relative h-40 bg-surface-raised shrink-0">
        {g.image_url && (
          <Image
            src={g.image_url}
            alt={g.title}
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
            {cat?.label ?? 'Guide'}
          </span>
        </div>
        <h3 className="text-[15px] font-extrabold text-prose leading-snug mb-2 group-hover:text-accent transition-colors line-clamp-2">
          {g.title}
        </h3>
        {g.excerpt && (
          <p className="text-xs text-prose-muted leading-relaxed line-clamp-2">
            {g.excerpt}
          </p>
        )}
        {g.reading_time_minutes && (
          <p className="text-[11px] text-prose-faint mt-3 pt-3 border-t border-soft">
            {g.reading_time_minutes} min read
          </p>
        )}
      </div>
    </Link>
  )
}
