import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/lib/products'

export const dynamic = 'force-dynamic'

export default async function ProductsListPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const admin = createAdminClient()
  const { data: products } = await admin
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  const rows = (products ?? []) as Product[]

  return (
    <div className="p-8 max-w-4xl">

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black">Products</h1>
          <p className="text-gray-500 text-sm mt-1">
            Canonical product rows referenced by <code className="text-orange-400">[[BUY:slug]]</code> tokens in reviews.
          </p>
        </div>
        <Link
          href="/dashboard/admin/products/new"
          className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New product
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-2">No products yet.</p>
          <p className="text-xs text-gray-600">
            Create one to start embedding <code className="text-orange-400">[[BUY:slug]]</code> affiliate links in reviews.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/admin/products/${p.id}`}
              className="flex items-center gap-4 p-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-gray-950 border border-gray-800">
                {p.image_url ? (
                  <Image
                    src={p.image_url}
                    alt={p.name}
                    fill
                    className="object-contain p-1"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{p.name}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  <code className="text-orange-400">[[BUY:{p.slug}]]</code>
                  {p.asin ? <span className="ml-3 text-gray-500">ASIN: {p.asin}</span> : null}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2 text-xs text-gray-600">
                {p.affiliate_url ? <span className="px-2 py-1 rounded-md bg-orange-950/40 text-orange-400 border border-orange-900/40">{p.store === 'amazon' ? 'Amazon' : p.store === 'other' ? (p.custom_store_name ?? 'Other') : p.store}</span> : null}
                {!p.affiliate_url && p.non_affiliate_url ? <span className="px-2 py-1 rounded-md bg-gray-800 text-gray-400 border border-gray-700">Link</span> : null}
                {!p.affiliate_url && !p.non_affiliate_url ? <span className="px-2 py-1 rounded-md bg-red-950/40 text-red-400 border border-red-900/40">No URL</span> : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
