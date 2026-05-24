import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStatusColor, getStatusLabel, type WishlistStatus } from '@/lib/wishlist'
import { LABELS } from '@/lib/labels'

interface Props {
  heading?: string
  ctaText?: string
  /** Subhead under the eyebrow — defaults to the canonical bench tagline.
   *  Pass null to hide; pass a string to override. */
  subhead?: string | null
}

const STATUS_RANK: Record<string, number> = { testing: 0, queued: 1, considering: 2 }

export default async function BenchStrip({
  heading = 'On the Bench',
  ctaText = "Vote on what's next",
  subhead = LABELS.bench.shortTagline,
}: Props) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('wishlist_items')
    .select('id, slug, title, image_url, status')
    .in('status', ['testing', 'queued', 'considering'])
    .order('priority', { ascending: false })
    .limit(20)

  const items = (data ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    .slice(0, 3)

  if (items.length === 0) return null

  return (
    <div className="rounded-xl bg-surface border border-soft shadow-md shadow-black/30 p-5 sm:p-6">
      {/* Header — eyebrow + invitation tagline + CTA. The pulsing dot
          uses the action orange (vibrant) for "live testing signal"
          while the eyebrow text stays in the orange-700 brand voice. */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(229,90,26,0.7)]" />
            <span className="text-xs font-black uppercase tracking-[0.18em] text-eyebrow">{heading}</span>
          </div>
          {subhead && (
            <p className="mt-1.5 text-xs text-prose-muted leading-snug">{subhead}</p>
          )}
        </div>
        <Link href="/bench" className="shrink-0 text-xs text-prose-muted hover:text-copper transition-colors font-semibold whitespace-nowrap uppercase tracking-widest">
          {ctaText} →
        </Link>
      </div>

      {/* Queue rows */}
      <ul className="divide-y divide-soft">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/bench/${item.slug}`}
              className="group flex items-center gap-3 sm:gap-4 py-3 -mx-2 px-2 rounded-lg hover:bg-surface-raised transition-colors min-h-[64px]"
            >
              {/* Thumbnail — square, fills */}
              <div className="relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-surface-sunken border border-soft">
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Status pill — fixed-width column so titles align */}
              <span
                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface-raised border border-soft shrink-0 text-center sm:min-w-[88px] ${getStatusColor(item.status as WishlistStatus)}`}
              >
                {getStatusLabel(item.status as WishlistStatus)}
              </span>

              {/* Title */}
              <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors line-clamp-1 flex-1">
                {item.title}
              </p>

              {/* Arrow */}
              <span aria-hidden className="text-prose-faint group-hover:text-copper transition-colors text-lg shrink-0">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
