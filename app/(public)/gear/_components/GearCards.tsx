import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import CategoryIcon from '@/components/CategoryIcon'
import BadgesForProduct from '@/components/collections/BadgesForProduct'
import type { ProductBadge } from '@/lib/collection-listings'

// Shared gear card/row primitives + row type. Extracted from gear/page.tsx so
// the static /gear index and the path-based /gear/category/[slug] route render
// identical cards (audit H3 index-filtering follow-up).
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

export function GearCard({
  review: r,
  isHero = false,
  eyebrow,
}: {
  review: GearReview
  isHero?: boolean
  eyebrow?: string | null
}) {
  const cat = getCategoryBySlug(r.category)
  const resolvedEyebrow = eyebrow === null ? null : eyebrow ?? cat?.label ?? null
  const showCategoryIcon = eyebrow === undefined && Boolean(cat)
  // Overlay-link pattern: article wrapper is non-clickable; title <Link> uses
  // after:absolute after:inset-0 to make the whole card clickable as a link.
  // Badges sit above the overlay via relative z-10, so their own links work.
  // Avoids invalid <a>-inside-<a> HTML that nested cards had previously.
  return (
    <article
      className={`group relative flex flex-col bg-surface rounded-xl overflow-hidden border border-soft shadow-lg shadow-black/5 hover:border-accent-border/40 hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1 transition-all duration-200 ${
        isHero ? 'lg:col-span-2 lg:row-span-2' : ''
      }`}
    >
      {r.image_url ? (
        <div className={`relative w-full bg-surface-raised shrink-0 ${
          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
        }`}>
          <Image
            src={r.image_url}
            alt={r.product_name}
            fill
            priority={isHero}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes={
              isHero
                ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 680px'
                : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
            }
          />
        </div>
      ) : (
        <div className={`w-full bg-surface-raised flex items-center justify-center shrink-0 ${
          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
        }`}>
          {cat && <CategoryIcon slug={cat.slug} className={isHero ? 'w-12 h-12 text-accent-text/40' : 'w-8 h-8 text-accent-text/40'} />}
        </div>
      )}
      <div className={`flex flex-col flex-1 ${isHero ? 'p-6 lg:p-7' : 'p-5'}`}>
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
          <RatingScore rating={r.rating ?? 0} />
        </div>
        <h3 className={`leading-snug flex-1 ${
          isHero ? 'text-xl md:text-2xl font-black text-prose' : 'text-base font-semibold'
        }`}>
          <Link
            href={`/reviews/${r.slug}`}
            className="after:absolute after:inset-0 group-hover:text-accent-text-soft transition-colors"
          >
            {r.title}
          </Link>
        </h3>
        {r.excerpt && (
          <p className={`text-prose-faint mt-2 ${
            isHero ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2'
          }`}>
            {r.excerpt}
          </p>
        )}
        {r.badges && r.badges.length > 0 && (
          <div className="relative z-10">
            <BadgesForProduct badges={r.badges} max={isHero ? 3 : 2} compact={!isHero} />
          </div>
        )}
        <div className="mt-4 pt-4">
          <span className="text-xs text-accent-text font-medium">Read full review</span>
        </div>
      </div>
    </article>
  )
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
