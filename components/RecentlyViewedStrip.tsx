'use client'
import { useState, useEffect, startTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getRecent } from '@/lib/recently-viewed'
import type { ViewedItem } from '@/lib/recently-viewed'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'

interface Props {
  /** Hide the item currently being viewed so it doesn't self-reference. */
  exclude?: { slug: string; type: string }
  /** Max items to display. Default 5. */
  max?: number
  className?: string
}

export default function RecentlyViewedStrip({ exclude, max = 5, className = '' }: Props) {
  const [items, setItems] = useState<ViewedItem[]>([])

  useEffect(() => {
    startTransition(() => setItems(getRecent(exclude).slice(0, max)))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) return null

  return (
    <section aria-label="Recently viewed" className={className}>
      <div className="mb-4">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <h2 className="text-lg font-black">Recently Viewed</h2>
      </div>

      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden -mx-6 px-6">
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
          {items.map((item) => <RecentCard key={`${item.type}:${item.slug}`} item={item} compact />)}
        </div>
      </div>

      {/* Desktop: centered row of fixed-width cards that wraps. Centering keeps
          a partial last row balanced (3+2 reads intentional, not lopsided) and
          fixed width avoids both ragged uneven pills and lone cards stretching
          full-width — works for any count (1–5). */}
      <div className="hidden sm:flex sm:flex-wrap sm:justify-center gap-3">
        {items.map((item) => <RecentCard key={`${item.type}:${item.slug}`} item={item} />)}
      </div>
    </section>
  )
}

function RecentCard({ item, compact = false }: { item: ViewedItem; compact?: boolean }) {
  const cat = item.category ? getCategoryBySlug(item.category) : null
  const href = `/${item.type === 'review' ? 'reviews' : 'guides'}/${item.slug}`

  return (
    <Link
      href={href}
      className={`group flex items-center gap-2.5 bg-surface border border-soft hover:border-accent-border/40 rounded-xl transition-colors ${
        compact ? 'shrink-0 w-56 px-3 py-2.5' : 'w-56 px-3 py-2.5'
      }`}
    >
      {item.image_url && (
        <Image
          src={item.image_url}
          alt=""
          aria-hidden
          width={32}
          height={32}
          className="w-8 h-8 rounded-lg object-cover shrink-0"
        />
      )}
      <div className="min-w-0">
        {cat && (
          <div className="flex items-center gap-1 mb-0.5">
            <CategoryIcon slug={cat.slug} className="w-3 h-3 text-accent-text shrink-0" />
            <span className="text-[9px] uppercase tracking-widest font-semibold text-eyebrow truncate">{cat.label}</span>
          </div>
        )}
        <p className="text-xs font-semibold text-prose group-hover:text-accent-text-soft transition-colors line-clamp-2 leading-snug">
          {item.title}
        </p>
      </div>
    </Link>
  )
}
