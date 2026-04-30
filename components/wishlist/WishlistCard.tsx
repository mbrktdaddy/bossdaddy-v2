import Link from 'next/link'
import Image from 'next/image'
import type { WishlistItem } from '@/lib/wishlist'
import { getBuyLabel } from '@/lib/wishlist'
import { StatusBadge } from './StatusBadge'

interface Props {
  item: WishlistItem
}

export function WishlistCard({ item }: Props) {
  return (
    <div className="bg-[var(--bd-surface)] rounded-2xl overflow-hidden flex flex-col shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200">
      {/* Image */}
      <Link href={`/wishlist/${item.slug}`} className="block relative aspect-[4/3] bg-zinc-900">
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
          <Link href={`/wishlist/${item.slug}`} className="text-sm font-bold leading-snug hover:text-orange-400 transition-colors line-clamp-2">
            {item.title}
          </Link>
          <StatusBadge status={item.status} className="shrink-0" />
        </div>

        {item.description && (
          <p className="text-xs text-[var(--bd-text-muted)] line-clamp-2">{item.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {/* Vote count */}
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
            {item.vote_count ?? 0} {(item.vote_count ?? 0) === 1 ? 'vote' : 'votes'}
          </span>

          {/* CTA */}
          {item.status === 'reviewed' && item.review_id ? (
            <Link
              href={`/wishlist/${item.slug}`}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              Read review
            </Link>
          ) : item.affiliate_url && item.store ? (
            <a
              href={`/go/${item.slug}`}
              target="_blank"
              rel="sponsored nofollow noopener"
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
            >
              {getBuyLabel(item.store, item.custom_store_name)}
            </a>
          ) : (
            <Link href={`/wishlist/${item.slug}`} className="text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors">
              Vote
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
