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
    // Bug fix: the prior select dropped wins_category / role_label / best_for,
    // so saved labels never rehydrated into the form. Always fetch every
    // editable column the form can write back.
    admin.from('collection_items')
      .select('id, review_id, position, blurb, wins_category, role_label, best_for, reviews(id, slug, title, product_name, category, rating, image_url, product_slug)')
      .eq('collection_id', id)
      .order('position'),
  ])

  if (!pick) notFound()

  // Resolve product prices for the items so the workspace can render a price-
  // range readout above the picks list — same shape used by public pages.
  const productSlugs = [
    ...new Set(
      (items ?? [])
        .map((i) => {
          const r = i.reviews
          const row = Array.isArray(r) ? r[0] : r
          return (row as { product_slug?: string | null } | null)?.product_slug ?? null
        })
        .filter((s): s is string => Boolean(s)),
    ),
  ]
  const priceMap = new Map<string, number | null>()
  if (productSlugs.length > 0) {
    const { data: products } = await admin
      .from('products')
      .select('slug, price_cents')
      .in('slug', productSlugs)
    for (const p of products ?? []) priceMap.set(p.slug, p.price_cents ?? null)
  }
  const itemsWithPrice = (items ?? [])
    // Product-only items (review_id null, mig 110) aren't editable in PickForm
    // yet — that's the next builder phase. Render review-backed items for now.
    .filter((i): i is typeof i & { review_id: string } => i.review_id !== null)
    .map((i) => {
      const r = i.reviews
      const row = Array.isArray(r) ? r[0] : r
      const slug = (row as { product_slug?: string | null } | null)?.product_slug ?? null
      const price_cents = slug ? priceMap.get(slug) ?? null : null
      return { ...i, price_cents }
    })

  // Cast: collections.faqs is generated as `Json` (any-shape jsonb) but the
  // workspace uses the structured CollectionFAQ[] shape we enforce at the
  // API/zod layer. The cast is safe because every write path validates against
  // FaqSchema before insert. WorkspaceShell supplies its own header/back-link.
  return (
    <CollectionWorkspace
      pick={pick as unknown as Parameters<typeof CollectionWorkspace>[0]['pick']}
      initialItems={itemsWithPrice}
    />
  )
}
