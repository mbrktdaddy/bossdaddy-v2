import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'

/** One Boss Approved product on the homepage board. Sourced from reviews rated
 *  8+ — the same rule as /gear — so the board and the gear hub can't disagree. */
export interface TopPick {
  id: string
  slug: string
  product_name: string
  category: string
  rating: number | null
  image_url: string | null
  /** What he actually paid, in cents — shown as "Paid $X". Honest, not a list price. */
  price_paid_cents: number | null
  is_top_pick: boolean | null
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

/**
 * The product board — the one format every gear publication leads with and
 * this homepage never had (light-editorial review, 2026-10-08, gap #3): the
 * product as an OBJECT. Image on a neutral well, name, what it cost, the score.
 * Two-up on a phone, four-up on desktop. Borderless, like every content card.
 *
 * "Paid $X" rather than a list price: the site's claim is that he bought it,
 * and the number he paid is the number that backs that up. Omitted when unset.
 */
export default function TopPicksBoard({ items }: { items: TopPick[] }) {
  if (items.length === 0) return null
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
      {items.map((p) => {
        const cat = getCategoryBySlug(p.category)
        const price = p.price_paid_cents != null && p.price_paid_cents > 0 ? usd.format(p.price_paid_cents / 100) : null
        return (
          <li key={p.id}>
            <Link href={`/reviews/${p.slug}`} className="group flex flex-col">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-surface-raised">
                {p.image_url && (
                  <Image
                    src={p.image_url}
                    alt="" /* decorative: the link's text names the product */
                    fill
                    sizes="(max-width: 768px) 50vw, 280px"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                )}
                {p.is_top_pick && (
                  <span className="absolute top-2 left-2 bg-chrome text-white text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-1 rounded-sm">
                    Top pick
                  </span>
                )}
              </div>
              <p className="mt-3 text-[10px] font-extrabold text-eyebrow uppercase tracking-[0.16em]">
                {cat?.shortLabel ?? p.category}
              </p>
              <h3 className="mt-1 text-base font-extrabold text-prose leading-snug tracking-tight group-hover:text-accent transition-colors line-clamp-2">
                {p.product_name}
              </h3>
              <div className="mt-2 flex items-center justify-between gap-3">
                <RatingScore rating={p.rating ?? 0} />
                {price && <span className="text-xs text-prose-faint whitespace-nowrap">Paid {price}</span>}
              </div>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
