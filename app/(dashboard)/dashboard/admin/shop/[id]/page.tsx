import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ShopProduct } from '@/lib/shop'
import { ShopProductForm } from '../_components/ShopProductForm'

export const dynamic = 'force-dynamic'

export default async function AdminShopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const isNew = id === 'new'
  let product: ShopProduct | null = null

  if (!isNew) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('shop_products')
      .select('*')
      .eq('id', id)
      .single()
    if (!data) notFound()
    product = data as ShopProduct
  }

  return (
    <div className="p-8 max-w-2xl">
      <Link
        href="/dashboard/admin/shop"
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors mb-6"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        All shop items
      </Link>

      <h1 className="text-2xl font-black mb-1">
        {isNew ? 'New shop item' : product!.name}
      </h1>
      <p className="text-gray-500 text-sm mb-8">
        {isNew
          ? 'Add a new piece of branded merch — start with status "Coming soon" to show a Notify me card.'
          : 'Edit this shop item.'}
      </p>

      <ShopProductForm product={product} />
    </div>
  )
}
