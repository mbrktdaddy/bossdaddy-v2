import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import CategoryIcon from '@/components/CategoryIcon'
import type { ProductBadge } from '@/lib/collection-listings'

// Gear row primitive + row type, shared by /gear and /gear/category/[slug].
// Gear CARDS are the shared components/ReviewCard (hero + headingLevel="h3").
export type GearReview = {
  id: string
  slug: string
  title: string
  product_name: string
  category: string
  rating: number | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  product_slug: string | null
  is_top_pick?: boolean
  // Pre-resolved collection badges. Batch-fetched once at the page level.
  badges?: ProductBadge[]
}

// Compact editorial row treatment for the lowest tier — mirrors the
// homepage Latest Guides geometry but flipped (image left, title right)
// so the two surfaces don't read as identical.
export function GearRow({ review: r }: { review: GearReview }) {
  const cat = getCategoryBySlug(r.category)
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group flex items-center gap-5 py-5 -mx-4 px-4 rounded-xl hover:bg-surface/40 transition-colors"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-raised shrink-0">
        {r.image_url ? (
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 80px, 96px"
          />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-center justify-center">
            {cat && <CategoryIcon slug={cat.slug} className="w-6 h-6 text-accent-text/40" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {cat && <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text" />}
          <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {cat?.shortLabel ?? r.category}
          </span>
        </div>
        <h3 className="text-base md:text-lg font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug">
          {r.title}
        </h3>
        <p className="text-xs text-prose-faint mt-1 truncate">{r.product_name}</p>
      </div>
      <div className="shrink-0">
        <RatingScore rating={r.rating ?? 0} />
      </div>
    </Link>
  )
}
