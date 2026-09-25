import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStatusColor, getStatusLabel, type WishlistStatus } from '@/lib/wishlist'
import { LABELS } from '@/lib/labels'
import { Card } from '@/components/ui/Card'
import { PhotoIcon } from '@/components/icons'

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
    .from('products')
    .select('id, slug, title:name, image_url, status')
    .in('status', ['testing', 'queued', 'considering'])
    .order('priority', { ascending: false })
    .limit(20)

  const items = (data ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    .slice(0, 3)

  if (items.length === 0) return null

  return (
    <Card className="p-5 sm:p-6">
      {/* Header — eyebrow + invitation tagline + CTA. The pulsing dot
          uses the action orange (vibrant) for "live testing signal"
          while the eyebrow text stays in the orange-700 brand voice. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(229,90,26,0.7)]" />
            <span className="text-xs font-black uppercase tracking-[0.18em] text-eyebrow">{heading}</span>
          </div>
          {subhead && (
            <p className="mt-1.5 text-xs text-prose-muted leading-snug">{subhead}</p>
          )}
        </div>
        <Link href="/bench" className="self-start shrink-0 text-xs text-prose-muted hover:text-copper transition-colors font-semibold whitespace-nowrap uppercase tracking-widest">
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
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PhotoIcon className="w-5 h-5 text-prose-faint" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Pill + title. On mobile they stack: in one row the fixed-width pill
                  left the title ~40% of a 320px screen, so `line-clamp-1` chopped
                  nearly every product name. Stacked, the title gets the full width and
                  two lines. From `sm` up it's the original single row, where the pill's
                  min-width keeps titles aligned down the list. */}
              <div className="min-w-0 flex-1 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-surface-raised border border-soft shrink-0 text-center sm:min-w-[88px] ${getStatusColor(item.status as WishlistStatus)}`}
                >
                  {getStatusLabel(item.status as WishlistStatus)}
                </span>
                <p className="min-w-0 text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors line-clamp-2 sm:line-clamp-1 sm:flex-1">
                  {item.title}
                </p>
              </div>

              {/* Arrow */}
              <span aria-hidden className="text-prose-faint group-hover:text-copper transition-colors text-lg shrink-0">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
