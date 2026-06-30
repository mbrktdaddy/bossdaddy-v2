import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { CollectionWorkspace } from '../_components/CollectionWorkspace'

export const dynamic = 'force-dynamic'

export default async function EditPickPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAdmin()

  const admin = createAdminClient()
  const [{ data: pick }, { data: items }] = await Promise.all([
    admin.from('collections').select('*').eq('id', id).single(),
    // Fetch every editable column the workspace can write back, plus BOTH item
    // sources (mig 110): review-backed items join `reviews`, product-only items
    // join `products`.
    admin.from('collection_items')
      .select('id, review_id, product_slug, position, blurb, wins_category, role_label, best_for, reviews(id, slug, title, product_name, category, rating, image_url, product_slug), products(slug, name, brand, image_url, category, status, price_cents)')
      .eq('collection_id', id)
      .order('position'),
  ])

  if (!pick) notFound()

  // Resolve product prices so the workspace can render a price-range readout.
  // Review-backed items price via the review's linked product slug; product-only
  // items carry price_cents on their own joined product row.
  const reviewProductSlugs = [
    ...new Set(
      (items ?? [])
        .map((i) => {
          if (!i.review_id) return null
          const r = i.reviews
          const row = Array.isArray(r) ? r[0] : r
          return (row as { product_slug?: string | null } | null)?.product_slug ?? null
        })
        .filter((s): s is string => Boolean(s)),
    ),
  ]
  const priceMap = new Map<string, number | null>()
  if (reviewProductSlugs.length > 0) {
    const { data: products } = await admin
      .from('products')
      .select('slug, price_cents')
      .in('slug', reviewProductSlugs)
    for (const p of products ?? []) priceMap.set(p.slug, p.price_cents ?? null)
  }

  const itemsWithPrice = (items ?? []).map((i) => {
    let price_cents: number | null = null
    if (i.review_id) {
      const r = i.reviews
      const row = Array.isArray(r) ? r[0] : r
      const slug = (row as { product_slug?: string | null } | null)?.product_slug ?? null
      price_cents = slug ? priceMap.get(slug) ?? null : null
    } else {
      const p = i.products
      const row = Array.isArray(p) ? p[0] : p
      price_cents = (row as { price_cents?: number | null } | null)?.price_cents ?? null
    }
    return { ...i, price_cents }
  })

  // Cast: collections.faqs is generated as `Json` (any-shape jsonb) but the
  // workspace uses the structured CollectionFAQ[] shape we enforce at the
  // API/zod layer. The cast is safe because every write path validates against
  // FaqSchema before insert. WorkspaceShell supplies its own header/back-link.
  return (
    <CollectionWorkspace
      pick={pick as unknown as Parameters<typeof CollectionWorkspace>[0]['pick']}
      initialItems={itemsWithPrice as unknown as Parameters<typeof CollectionWorkspace>[0]['initialItems']}
    />
  )
}
