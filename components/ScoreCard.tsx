import Link from 'next/link'
import Image from 'next/image'
import ScoreBubble from './ScoreBubble'
import { getCategoryBySlug } from '@/lib/categories'

interface Review {
  slug: string
  product_name: string
  category: string
  rating: number | null
  image_url: string | null
}

interface Props {
  review: Review
  priority?: boolean
}

/**
 * Top-rated review card. Image with score bubble overlay, progress bar
 * under the image, then product name + category. Used in the "Top Scores"
 * homepage grid. Pair with [DroppedCard] which is recency-focused and
 * intentionally has NO score visible.
 */
export default function ScoreCard({ review, priority }: Props) {
  const cat = getCategoryBySlug(review.category)
  const pct = ((review.rating ?? 0) / 10) * 100

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="group flex flex-col bg-surface border border-soft rounded-2xl overflow-hidden shadow-md shadow-black/[0.04] hover:shadow-lg hover:shadow-black/[0.08] hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative h-40 bg-surface-raised shrink-0">
        {review.image_url && (
          <Image
            src={review.image_url}
            alt={review.product_name}
            fill
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        )}
        <ScoreBubble rating={review.rating} position="bottom-left" />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="h-[3px] bg-soft rounded-full mb-3 overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <h3 className="text-sm font-extrabold text-prose leading-snug mb-1 group-hover:text-accent transition-colors">
          {review.product_name}
        </h3>
        <p className="text-[11px] font-semibold text-prose-muted">
          {cat?.label ?? review.category}
        </p>
      </div>
    </Link>
  )
}
