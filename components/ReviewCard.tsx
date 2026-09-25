import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import BadgesForProduct from '@/components/collections/BadgesForProduct'
import type { ProductBadge } from '@/lib/collection-listings'
import { Card } from '@/components/ui/Card'

// THE review card — /reviews grids and the /gear tiers both render this, so a
// tested product looks (and earns its Boss Approved badge) the same everywhere.
// Structural type: /reviews' ReviewRow and /gear's GearReview both satisfy it.
export type ReviewCardData = {
  slug: string
  title: string
  product_name: string
  category: string
  rating: number | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  badges?: ProductBadge[]
}

// Eyebrow doctrine: undefined = default to category (icon + label); null =
// suppress (use on category/tag landing pages where the page header carries
// the classifier); string = role override (e.g., "Winner", "Top Pick").
//
// Overlay-link pattern: the article isn't clickable; the title <Link> stretches
// over the card with after:absolute after:inset-0. Badges sit above the overlay
// (relative z-10) so their own links work — no invalid <a>-inside-<a>.
export default function ReviewCard({
  review: r,
  priority = false,
  eyebrow,
  hero = false,
  headingLevel = 'h2',
}: {
  review: ReviewCardData
  priority?: boolean
  eyebrow?: string | null
  /** Double-size lead card spanning 2×2 in a 3-col grid (/gear top tier). */
  hero?: boolean
  /** h3 when the grid sits under its own section heading. */
  headingLevel?: 'h2' | 'h3'
}) {
  const cat = getCategoryBySlug(r.category)
  const rating = r.rating ?? 0
  const resolvedEyebrow = eyebrow === null ? null : eyebrow ?? cat?.label ?? null
  const showCategoryIcon = eyebrow === undefined && Boolean(cat)
  const Heading = headingLevel
  const mediaHeight = hero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
  return (
    <Card as="article" className={`group relative flex flex-col overflow-hidden hover:border-copper hover:-translate-y-1 transition-all duration-200 ${hero ? 'lg:col-span-2 lg:row-span-2' : ''}`}>
      {r.image_url ? (
        <div className={`relative w-full ${mediaHeight} bg-surface-raised shrink-0`}>
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            priority={priority || hero}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={hero
              ? '(max-width: 1024px) 100vw, 680px'
              : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'}
          />
          {rating >= 8 && (
            <div className="absolute top-3 right-3">
              <BossApprovedBadge size="sm" variant="card" />
            </div>
          )}
        </div>
      ) : (
        <div className={`w-full ${mediaHeight} shrink-0 bg-gradient-to-br ${
          cat?.color ?? 'from-surface-raised to-surface'
        } flex items-center justify-center`}>
          {cat ? (
            <CategoryIcon slug={cat.slug} className={`${hero ? 'w-12 h-12' : 'w-10 h-10'} text-accent-text opacity-40`} />
          ) : (
            <svg className="w-10 h-10 text-prose-faint opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
      )}
      <div className={`flex flex-col flex-1 ${hero ? 'p-6 lg:p-7' : 'p-5'}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-1.5 min-w-0">
            {resolvedEyebrow && (
              <>
                {showCategoryIcon && cat && (
                  <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                )}
                <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                  {resolvedEyebrow}
                </span>
              </>
            )}
          </div>
          <RatingScore rating={rating} />
        </div>
        <Heading className={`leading-snug text-prose flex-1 ${hero ? 'text-xl md:text-2xl font-black' : 'text-base font-bold'}`}>
          <Link
            href={`/reviews/${r.slug}`}
            className="after:absolute after:inset-0 group-hover:text-accent-text-soft transition-colors"
          >
            {r.title}
          </Link>
        </Heading>
        {r.excerpt && (
          <p className={`text-prose-muted mt-2 ${hero ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2'}`}>{r.excerpt}</p>
        )}
        {r.badges && r.badges.length > 0 && (
          <div className="relative z-10">
            <BadgesForProduct badges={r.badges} max={hero ? 3 : 2} compact={!hero} />
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
    </Card>
  )
}
