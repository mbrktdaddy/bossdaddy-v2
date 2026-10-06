import Image from 'next/image'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import CategoryIcon from '@/components/CategoryIcon'
import { PhotoIcon } from '@/components/icons'
import { ProductClaimLine } from '@/components/products/ProductClaimLine'
import { StatusBadge } from '@/components/wishlist/StatusBadge'
import { RadarVote } from '@/components/wishlist/RadarVote'
import { getCategoryBySlug } from '@/lib/categories'
import { getBuyLabel, requestedByLabel } from '@/lib/wishlist'
import { formatSpotted, radarOutcome, type RadarItem } from '@/lib/products/radar'

interface Props {
  item: RadarItem
  headingLevel?: 'h2' | 'h3'
}

/**
 * One On the Radar card: the product, the take, and where it stands.
 *
 * Showcasing claims nothing (brand-guide §1.9): no score, no "tested" badge and
 * no default "not tested" chip. The card only adds what the operator set ("Bought
 * it", the provided-unit disclosure) and, once the item moves on, its outcome.
 * There's no per-item page (plan: avoids thin pages), so nothing links to one.
 * Buy links render only while the item is live; the page puts its FTC line above.
 */
export function RadarCard({ item, headingLevel: Heading = 'h3' }: Props) {
  const outcome = radarOutcome(item)
  if (!outcome) return null
  const cat = item.category ? getCategoryBySlug(item.category) : null

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <div className="relative aspect-[4/3] bg-surface-raised">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-contain p-4"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PhotoIcon className="w-12 h-12 text-prose-faint" strokeWidth={1} />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            {cat ? (
              <span className="flex items-center gap-2 min-w-0 text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold">
                <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 shrink-0 text-accent-text" />
                <span className="truncate">{cat.shortLabel}</span>
              </span>
            ) : <span />}
            <span className="shrink-0 text-xs text-prose-faint">
              Spotted <time dateTime={item.spotted_at}>{formatSpotted(item.spotted_at)}</time>
            </span>
          </div>
          <Heading className="mt-2 text-base font-bold text-prose leading-snug">{item.name}</Heading>
        </div>

        {item.take && (
          <p className="text-sm text-prose-muted leading-relaxed whitespace-pre-line">{item.take}</p>
        )}

        <ProductClaimLine product={item} stage={false} />

        <div className="mt-auto pt-3 border-t border-soft">
          {outcome.kind === 'live' && (
            <>
              <RadarVote itemId={item.id} initialCount={item.vote_count} />
              {item.affiliate_url && (
                <a
                  href={`/go/${item.slug}`}
                  target="_blank"
                  rel="sponsored nofollow noopener"
                  className="mt-1 inline-flex items-center min-h-[44px] text-xs font-semibold text-accent-text-soft hover:text-accent transition-colors"
                >
                  {getBuyLabel(item.store, item.custom_store_name)} →
                </a>
              )}
            </>
          )}

          {outcome.kind === 'bench' && (
            <Link
              href={outcome.href}
              className="group flex items-center justify-between gap-3 min-h-[44px]"
            >
              <span className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-sm font-semibold text-prose group-hover:text-accent-text-soft transition-colors">Moved to the Bench</span>
                <StatusBadge status={outcome.status} />
              </span>
              <span aria-hidden className="text-prose-faint group-hover:text-copper transition-colors">→</span>
            </Link>
          )}

          {outcome.kind === 'reviewed' && (
            <Link
              href={outcome.href}
              className="group flex items-center justify-between gap-3 min-h-[44px]"
            >
              <span className="flex flex-wrap items-center gap-2 min-w-0">
                <StatusBadge status="reviewed" />
                {outcome.rating != null && (
                  <span className="text-sm font-black text-prose tabular-nums">{outcome.rating}/10</span>
                )}
              </span>
              <span className="shrink-0 text-xs font-semibold text-accent-text-soft group-hover:text-accent transition-colors">
                Read the review →
              </span>
            </Link>
          )}

          {outcome.kind === 'passed' && (
            <div className="min-h-[44px] flex flex-col justify-center gap-1.5">
              <StatusBadge status="passed" className="self-start" />
              {outcome.reason && <p className="text-xs text-prose-muted leading-relaxed">{outcome.reason}</p>}
            </div>
          )}

          {/* Votes carry over, so a request still counts after the item moves on. */}
          {outcome.kind !== 'live' && item.vote_count > 0 && (
            <p className="mt-1 text-xs text-prose-faint tabular-nums">{requestedByLabel(item.vote_count)}</p>
          )}
        </div>
      </div>
    </Card>
  )
}
