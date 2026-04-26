import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import type { ReviewRow } from '../actions'

export default function ReviewCard({ review: r, priority = false }: { review: ReviewRow; priority?: boolean }) {
  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
    >
      {r.image_url ? (
        <div className="relative w-full h-44 bg-gray-800 shrink-0">
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
          getCategoryBySlug(r.category)?.color ?? 'from-gray-800 to-gray-900'
        } flex items-center justify-center`}>
          <span className="text-4xl opacity-40">
            {getCategoryBySlug(r.category)?.icon ?? '📦'}
          </span>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
            {r.product_name}
          </span>
          <RatingScore rating={r.rating} />
        </div>
        <h2 className="text-base font-bold leading-snug text-white group-hover:text-orange-400 transition-colors flex-1">
          {r.title}
        </h2>
        {r.excerpt && (
          <p className="text-gray-400 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <span className="text-xs text-gray-500">
            {r.published_at
              ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </span>
          <span className="text-xs text-orange-500 font-medium">Read review →</span>
        </div>
      </div>
    </Link>
  )
}
