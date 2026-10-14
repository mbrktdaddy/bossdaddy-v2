import Link from 'next/link'
import Image from 'next/image'
import type { WishlistItem } from '@/lib/wishlist'
import { getBuyLabel, requestedByLabel } from '@/lib/wishlist'
import { StatusBadge } from './StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { PhotoIcon } from '@/components/icons'

interface Props {
  item: WishlistItem
}

export function WishlistCard({ item }: Props) {
  const voteCount = item.vote_count ?? 0
  // Bench routes are canonical; the prior /wishlist links 301-hopped through
  // proxy. Linking direct saves the redirect and unifies with the rest of
  // the site (footer, In Motion ticker, BenchStrip all already use /bench).
  const detailHref = `/bench/${item.slug}`

  return (
    <article className="flex flex-col">
      {/* Image */}
      <Link href={detailHref} className="block relative aspect-[4/3] bg-surface-raised rounded-xl overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.title}
            fill
            className="object-contain p-4"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <PhotoIcon className="w-12 h-12 text-prose-faint" strokeWidth={1} />
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="pt-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={detailHref} className="text-sm font-extrabold text-prose leading-snug hover:text-accent transition-colors line-clamp-2">
            {item.title}
          </Link>
          <StatusBadge status={item.status} className="shrink-0" />
        </div>

        {item.description && (
          <p className="text-xs text-prose-muted line-clamp-2">{item.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {/* Votes are cast on the Radar ("Want me to test it?") and carry over
              here, so the Bench shows who asked for it. Nothing at zero: the
              Bench's one job is follow, not a vote to chase. The empty span
              keeps the CTA right-aligned. */}
          {voteCount > 0 ? (
            <Badge tone="muted" className="tabular-nums">
              {requestedByLabel(voteCount)}
            </Badge>
          ) : <span />}

          {/* CTA — the affiliate buy link when there is one, otherwise the
              detail page, where the follow button lives. */}
          {item.status === 'reviewed' && item.review_id ? (
            <Link
              href={detailHref}
              className="text-xs font-semibold text-accent-text-soft hover:text-accent transition-colors"
            >
              Read review →
            </Link>
          ) : item.affiliate_url && item.store ? (
            <a
              href={`/go/${item.slug}`}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="text-xs font-semibold text-accent-text-soft hover:text-accent transition-colors"
            >
              {getBuyLabel(item.store, item.custom_store_name)}
            </a>
          ) : (
            <Link
              href={detailHref}
              className="text-xs font-bold text-accent-text-soft hover:text-accent transition-colors uppercase tracking-widest"
            >
              Follow →
            </Link>
          )}
        </div>
      </div>
    </article>
  )
}
