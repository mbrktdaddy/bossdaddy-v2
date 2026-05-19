import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import BadgesForProduct from '@/components/collections/BadgesForProduct'
import type { ReviewRow } from '../actions'

export default function ReviewCard({ review: r, priority = false }: { review: ReviewRow; priority?: boolean }) {
  // Overlay-link pattern: see GearCard for explanation. Avoids <a>-inside-<a>
  // hydration error when BadgesForProduct chips render inside the card.
  return (
    <article className="group relative flex flex-col bg-surface rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200">
      {r.image_url ? (
        <div className="relative w-full h-44 bg-surface-raised shrink-0">
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
          {r.rating >= 8 && (
            <div className="absolute top-3 right-3">
              <BossApprovedBadge size="sm" variant="card" />
            </div>
          )}
        </div>
      ) : (
        <div className={`w-full h-44 shrink-0 bg-gradient-to-br ${
          getCategoryBySlug(r.category)?.color ?? 'from-surface-raised to-surface'
        } flex items-center justify-center`}>
          <span className="text-4xl opacity-40">
            {getCategoryBySlug(r.category)?.icon ?? '📦'}
          </span>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-eyebrow/80 uppercase tracking-widest bg-accent-tint/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
            {r.product_name}
          </span>
          <RatingScore rating={r.rating} />
        </div>
        <h2 className="text-base font-bold leading-snug text-white flex-1">
          <Link
            href={`/reviews/${r.slug}`}
            className="after:absolute after:inset-0 group-hover:text-accent-text-soft transition-colors"
          >
            {r.title}
          </Link>
        </h2>
        {r.excerpt && (
          <p className="text-prose-muted text-sm mt-2 line-clamp-2">{r.excerpt}</p>
        )}
        {r.badges && r.badges.length > 0 && (
          <div className="relative z-10">
            <BadgesForProduct badges={r.badges} max={2} compact />
          </div>
        )}
        <div className="flex items-center justify-between mt-4 pt-4">
          <span className="text-xs text-prose-faint">
            {r.published_at
              ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </span>
          <span className="text-xs text-accent-text font-medium">Read review</span>
        </div>
      </div>
    </article>
  )
}
