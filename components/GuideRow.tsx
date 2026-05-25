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

interface Props {
  guide: Guide
  isLast?: boolean
}

/**
 * Editorial row-list item — text on the left, thumb on the right.
 * Visually differentiates guides (reading material) from the product-
 * card grids used for reviews and collections. Drop this in a stack
 * with `divide-y divide-soft` or pass `isLast` to suppress the bottom
 * rule manually.
 */
export default function GuideRow({ guide, isLast }: Props) {
  const cat = guide.category ? getCategoryBySlug(guide.category) : null
  const date = guide.published_at
    ? new Date(guide.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <Link
      href={`/guides/${guide.slug}`}
      className={`group flex items-center gap-4 sm:gap-5 py-5 ${isLast ? '' : 'border-b border-soft'}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-accent uppercase tracking-[0.16em] mb-1.5">
          {cat?.label ?? guide.category ?? 'Guide'}
        </p>
        <h3 className="text-base sm:text-lg font-extrabold text-prose leading-snug mb-1.5 group-hover:text-accent transition-colors">
          {guide.title}
        </h3>
        {guide.excerpt && (
          <p className="text-sm text-prose-muted leading-relaxed line-clamp-2 mb-2 hidden sm:block">
            {guide.excerpt}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-prose-faint">
          {guide.reading_time_minutes && <span>{guide.reading_time_minutes} min read</span>}
          {guide.reading_time_minutes && date && <span>·</span>}
          {date && <span>{date}</span>}
        </div>
      </div>
      <div className="shrink-0 w-20 h-16 sm:w-28 sm:h-20 rounded-xl overflow-hidden bg-surface-raised border border-soft">
        {guide.image_url ? (
          <Image
            src={guide.image_url}
            alt={guide.title}
            width={112}
            height={80}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-prose-faint/40">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
        )}
      </div>
    </Link>
  )
}
