import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStatusColor, getStatusLabel, type WishlistStatus } from '@/lib/wishlist'

interface Props {
  heading?: string
  ctaText?: string
}

const STATUS_RANK: Record<string, number> = { testing: 0, queued: 1, considering: 2 }

export default async function BenchStrip({
  heading = "On the Bench",
  ctaText = "Vote on what's next",
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
    <div className="rounded-2xl bg-gray-900/60 border border-gray-800/60 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(204,85,0,0.8)]" />
          <span className="text-xs font-black uppercase tracking-widest text-orange-500">{heading}</span>
        </div>
        <Link href="/bench" className="text-xs text-gray-500 hover:text-orange-400 transition-colors font-semibold">
          {ctaText} →
        </Link>
      </div>

      {/* Cards — horizontal scroll on mobile, 3-col grid on desktop */}
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-5 px-5 sm:mx-0 sm:px-0 sm:overflow-visible sm:grid sm:grid-cols-3 sm:gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/bench/${item.slug}`}
            className="shrink-0 w-44 sm:w-auto flex flex-col bg-gray-900 hover:bg-gray-800/90 rounded-xl overflow-hidden shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/50 transition-all group"
          >
            {/* Image (aspect-video, prominent) */}
            <div className="relative w-full aspect-video bg-gray-950">
              {item.image_url ? (
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 176px, 33vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {/* Status pill overlay */}
              <div className="absolute top-2 left-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm ${getStatusColor(item.status as WishlistStatus)}`}>
                  {getStatusLabel(item.status as WishlistStatus)}
                </span>
              </div>
            </div>

            {/* Title */}
            <div className="p-3">
              <p className="text-sm font-bold text-gray-200 group-hover:text-orange-400 line-clamp-2 leading-snug transition-colors">
                {item.title}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
