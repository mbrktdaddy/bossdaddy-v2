import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Product } from '@/lib/products'
import { ProductForm } from '../_components/ProductForm'

export const dynamic = 'force-dynamic'

export default async function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireAdmin()

  const isNew = id === 'new'
  let product: Product | null = null
  if (!isNew) {
    const admin = createAdminClient()
    const { data } = await admin.from('products').select('*').eq('id', id).single()
    if (!data) notFound()
    product = data as Product
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/admin/products"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← All products
        </Link>
      </div>
      <h1 className="text-2xl font-black mb-1">{isNew ? 'New product' : product?.name}</h1>
      <p className="text-gray-500 text-sm mb-8">
        {isNew
          ? 'Create a product row so [[BUY:slug]] tokens can resolve to this affiliate URL.'
          : 'Editing this product updates every future review token — existing resolved links in already-saved reviews are unaffected.'}
      </p>

      <ProductForm product={product} />
    </div>
  )
}
