import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SHOP_CATEGORIES, SHOP_STATUSES, formatPrice, type ShopProduct } from '@/lib/shop'

export const dynamic = 'force-dynamic'

export default async function AdminShopListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const admin = createAdminClient()
  const { data } = await admin
    .from('shop_products')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as ShopProduct[]

  const visibleCount = rows.filter((r) => SHOP_STATUSES.find((s) => s.value === r.status)?.publiclyVisible).length

  return (
    <div className="p-8 max-w-5xl">

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Shop</h1>
          <p className="text-gray-500 text-sm mt-1">
            Boss Daddy branded merch. {rows.length} item{rows.length === 1 ? '' : 's'} total · {visibleCount} publicly visible.
          </p>
        </div>
        <Link
          href="/dashboard/admin/shop/new"
          className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New item
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">No shop items yet.</p>
          <p className="text-xs text-gray-600">
            Add your first item — set status to <code className="text-orange-400">coming_soon</code> to show it on /shop with a "Notify me" CTA.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const cat = SHOP_CATEGORIES.find((c) => c.slug === p.category)
            const stat = SHOP_STATUSES.find((s) => s.value === p.status)
            return (
              <Link
                key={p.id}
                href={`/dashboard/admin/shop/${p.id}`}
                className="flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-colors"
              >
                {/* Thumbnail */}
                <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
                  {p.image_url ? (
                    <Image src={p.image_url} alt={p.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-50">
                      {cat?.icon ?? '📦'}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">{p.name}</p>
                    {cat && (
                      <span className="text-xs text-gray-500">
                        {cat.icon} {cat.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <code className="text-orange-400">{p.slug}</code>
                    <span className="ml-3">{formatPrice(p.price_cents) || 'no price'}</span>
                    <span className="ml-3 text-gray-700">pos {p.position}</span>
                  </p>
                </div>

                <div className="shrink-0">
                  <span
                    className={`px-2 py-1 text-xs rounded-md border ${
                      p.status === 'available'   ? 'bg-green-950/40 text-green-400 border-green-900/40'  :
                      p.status === 'coming_soon' ? 'bg-orange-950/40 text-orange-400 border-orange-900/40' :
                      p.status === 'concept'     ? 'bg-gray-800 text-gray-400 border-gray-700' :
                      'bg-red-950/40 text-red-400 border-red-900/40'
                    }`}
                  >
                    {stat?.label ?? p.status}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
