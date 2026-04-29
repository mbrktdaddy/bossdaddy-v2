import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { WishlistItem } from '@/lib/wishlist'
import { getStatusLabel, getStatusColor } from '@/lib/wishlist'

export const dynamic = 'force-dynamic'

export default async function WishlistAdminPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const { data } = await admin
    .from('wishlist_items')
    .select('*, vote_count:wishlist_votes(count)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  const items = ((data ?? []) as (WishlistItem & { vote_count: { count: number }[] })[]).map((i) => ({
    ...i,
    vote_count: i.vote_count?.[0]?.count ?? 0,
  }))

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Wishlist</h1>
          <p className="text-gray-500 text-sm mt-1">
            Products you plan to test. Members vote on what to review next.
          </p>
        </div>
        <Link
          href="/dashboard/admin/wishlist/new"
          className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New item
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">No wishlist items yet.</p>
          <p className="text-xs text-gray-600">Add products you&apos;re considering or currently testing.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/dashboard/admin/wishlist/${item.id}`}
              className="flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.title} fill className="object-contain p-1" sizes="48px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{item.title}</p>
                <p className="text-xs text-gray-600 mt-0.5">{item.slug}</p>
              </div>

              <div className="shrink-0 flex items-center gap-3 text-xs">
                <span className="text-gray-500">{item.vote_count as unknown as number} votes</span>
                <span className={`px-2 py-1 rounded-md bg-gray-800 border border-gray-700 font-medium ${getStatusColor(item.status)}`}>
                  {getStatusLabel(item.status)}
                </span>
                {item.review_id && (
                  <span className="px-2 py-1 rounded-md bg-orange-950/40 border border-orange-900/40 text-orange-400">Promoted</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
