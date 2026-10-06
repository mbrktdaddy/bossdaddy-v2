import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Product } from '@/lib/products'
import type { TestingNote } from '@/lib/products/testing-notes'
import { ProductForm } from '../_components/ProductForm'
import { TestingNotesPanel } from '../_components/TestingNotesPanel'

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
  let initialTags: string[] = []
  let notes: TestingNote[] = []
  if (!isNew) {
    const admin = createAdminClient()
    const { data } = await admin.from('products').select('*').eq('id', id).single()
    if (!data) notFound()
    product = data as unknown as Product
    const [{ data: tagRows }, { data: noteRows }] = await Promise.all([
      admin.from('product_tags').select('tag_slug').eq('product_id', id),
      admin.from('product_testing_notes').select('*').eq('product_id', id)
        .order('noted_on', { ascending: false }).order('created_at', { ascending: false }),
    ])
    initialTags = (tagRows ?? []).map((r) => r.tag_slug)
    notes = (noteRows ?? []) as TestingNote[]
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/admin/products"
          className="text-sm text-prose-faint hover:text-prose transition-colors"
        >
          ← All products
        </Link>
      </div>
      <h1 className="text-2xl font-black mb-1">{isNew ? 'New product' : product?.name}</h1>
      <p className="text-prose-faint text-sm mb-8">
        {isNew
          ? 'Create a product row so [[BUY:slug]] tokens can resolve to this affiliate URL.'
          : 'Editing this product updates every future review token — existing resolved links in already-saved reviews are unaffected.'}
      </p>

      <ProductForm
        product={product}
        initialTags={initialTags}
        amazonAssociateTag={process.env.AMAZON_ASSOCIATE_TAG ?? ''}
      />

      {product && <TestingNotesPanel productId={product.id} initialNotes={notes} />}
    </div>
  )
}
