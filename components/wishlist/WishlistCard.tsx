import Link from 'next/link'
import Image from 'next/image'
import type { WishlistItem } from '@/lib/wishlist'
import { getBuyLabel } from '@/lib/wishlist'
import { StatusBadge } from './StatusBadge'

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
    <div className="bg-surface rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/50 transition-all duration-200">
      {/* Image */}
      <Link href={detailHref} className="block relative aspect-[4/3] bg-zinc-900">
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
            <svg className="w-12 h-12 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={detailHref} className="text-sm font-bold leading-snug hover:text-accent-text-soft transition-colors line-clamp-2">
            {item.title}
          </Link>
          <StatusBadge status={item.status} className="shrink-0" />
        </div>

        {item.description && (
          <p className="text-xs text-prose-muted line-clamp-2">{item.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {/* Vote count — promoted visually so the engagement signal
              (popularity) is the first thing a scanner notices. Tabular nums
              keep the digit width stable as counts grow. */}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${
              voteCount > 0
                ? 'bg-accent-tint border border-accent-border/40 text-accent-text'
                : 'bg-zinc-900 border border-soft text-prose-faint'
            }`}
            title={voteCount > 0 ? `${voteCount} ${voteCount === 1 ? 'reader has' : 'readers have'} voted for this` : 'No votes yet — be the first'}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {voteCount}
            <span className="font-medium text-[10px] uppercase tracking-wider">{voteCount === 1 ? 'vote' : 'votes'}</span>
          </span>

          {/* CTA — Vote feels inviting (orange) rather than buried (gray) so
              the engagement loop is the more obvious call. Affiliate buy
              link is the deflection path when the item isn't yet under test. */}
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
              Vote →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
