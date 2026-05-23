import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import type { ReviewRow } from '@/app/(public)/reviews/actions'

export default function FeaturedReviewCard({ review: r, label = 'Featured Review' }: { review: ReviewRow; label?: string }) {
  const cat = getCategoryBySlug(r.category)

  return (
    <Link
      href={`/reviews/${r.slug}`}
      className="group relative flex flex-col sm:flex-row overflow-hidden rounded-2xl bg-surface shadow-xl shadow-stone-900/[0.08] hover:shadow-2xl hover:shadow-stone-900/[0.10] transition-all duration-300 mt-2 mb-20"
    >
      {/* Image */}
      <div className="relative w-full sm:w-[55%] h-56 sm:h-auto shrink-0 bg-surface-raised">
        {r.image_url ? (
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            priority
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 100vw, 55vw"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${cat?.color ?? 'from-surface-raised to-surface'} flex items-center justify-center`}>
            {cat ? <CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text opacity-30" /> : <span className="text-6xl opacity-30">📦</span>}
          </div>
        )}
        {/* Gradient overlay on mobile bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-surface to-transparent sm:hidden" />
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between p-6 sm:p-8 flex-1 min-w-0">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent-text bg-accent-tint px-2.5 py-1 rounded-full">
              {label}
            </span>
            {cat && (
              <span className="flex items-center gap-1 text-[10px] text-prose-faint uppercase tracking-widest"><CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-prose-faint" /> {cat.label}</span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black leading-snug text-prose group-hover:text-accent-text-soft transition-colors mb-3">
            {r.title}
          </h2>
          {r.excerpt && (
            <p className="text-prose-muted text-sm leading-relaxed line-clamp-3">{r.excerpt}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-soft/60">
          <div className="flex items-center gap-3">
            <RatingScore rating={r.rating} />
            {r.rating >= 8 && <BossApprovedBadge size="sm" variant="card" />}
          </div>
          <span className="text-sm font-semibold text-accent-text group-hover:text-accent-text-soft transition-colors">
            Read review →
          </span>
        </div>
      </div>
    </Link>
  )
}
