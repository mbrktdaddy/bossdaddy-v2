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
 * Medium-weight guide card — the middle tier of the homepage Library's cadence:
 * one lead split card, then a 3-up row of these, then compact GuideRows. The
 * descending weight is what keeps nine guides reading as an edited section
 * rather than a list that got truncated at nine.
 *
 * Deliberately shaped like VaultCard (h-40 image, dot + eyebrow, 2-line clamp)
 * because the Vault strip sits directly beneath this grid — matching the card
 * language keeps the two sections looking like one page. Distinct from
 * FeaturedGuideCard, which is a large horizontal split built for the /guides
 * listing hero and carries its own `mb-20`.
 */
export default function LibraryGuideCard({ guide: g }: { guide: Guide }) {
  const cat = g.category ? getCategoryBySlug(g.category) : null

  return (
    <Link
      href={`/guides/${g.slug}`}
      className="group flex flex-col bg-background border border-soft rounded-2xl overflow-hidden hover:border-accent hover:-translate-y-0.5 transition-all duration-200"
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
