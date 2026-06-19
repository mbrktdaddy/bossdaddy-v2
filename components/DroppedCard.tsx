import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'

interface Review {
  slug: string
  product_name: string
  category: string
  image_url: string | null
}

interface Props {
  review: Review
}

/**
 * Recently published review card — recency-focused, no rating visible.
 * Used in the homepage "Just Dropped" grid (NEW badge, no score), in
 * contrast to the ranked "Top Picks" list which leads with the score.
 */
export default function DroppedCard({ review }: Props) {
  const cat = getCategoryBySlug(review.category)

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden hover:border-strong hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative h-32 bg-surface-raised shrink-0">
        {review.image_url && (
          <Image
            src={review.image_url}
            alt={review.product_name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, 25vw"
          />
        )}
        <div className="absolute top-2.5 left-2.5 bg-accent text-white text-[9px] font-black uppercase tracking-[0.12em] px-2 py-0.5 rounded">
          New
        </div>
      </div>
      <div className="p-3.5 flex flex-col flex-1">
        <p className="text-[10px] font-bold text-prose-muted uppercase tracking-[0.12em] mb-1.5">
          {cat?.label ?? review.category}
        </p>
        <h3 className="text-[13px] font-extrabold text-prose leading-snug mb-1.5 group-hover:text-accent transition-colors line-clamp-2">
          {review.product_name}
        </h3>
        <p className="text-[11px] font-bold text-accent mt-auto">
          Read review →
        </p>
      </div>
    </Link>
  )
}
