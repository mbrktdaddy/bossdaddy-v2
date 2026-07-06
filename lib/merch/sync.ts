import { createAdminClient } from '@/lib/supabase/admin'
import { getSyncProducts, getSyncProductDetail, type PrintfulSyncProduct, type PrintfulSyncVariant } from '@/lib/printful'

// In-app port of scripts/sync-printful.mjs so the "Sync from Printful" button
// runs the exact same pull-and-upsert server-side. Keep this in lockstep with
// the CLI script (they intentionally mirror each other).

type Admin = ReturnType<typeof createAdminClient>

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const SIZE_TOKEN = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|XXL|XXXL|One Size|OS)$/i
function segments(variantName: string): string[] {
  return variantName.split('/').map((s) => s.trim()).filter(Boolean)
}
function parseSize(variantName: string): string | null {
  const parts = segments(variantName)
  const last = parts[parts.length - 1]
  return last && SIZE_TOKEN.test(last) ? last : null
}
function parseColor(variantName: string): string | null {
  const parts = segments(variantName)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]
  const colorParts = parts.slice(1, SIZE_TOKEN.test(last) ? -1 : undefined)
  return colorParts.length ? colorParts.join(' / ') : null
}

async function upsertMerch(
  admin: Admin,
  sp: PrintfulSyncProduct,
  images: string[],
  priceCents: number | null,
): Promise<string> {
  const { data: existing } = await admin
    .from('merch')
    .select('id, slug, price_cents')
    .eq('printful_sync_product_id', sp.id)
    .maybeSingle()

  const base = {
    name: sp.name,
    printful_sync_product_id: sp.id,
    default_image_url: sp.thumbnail_url,
    currency: 'USD',
    archived_at: null,
  }

  if (existing) {
    // Preserve operator status; set price only if unset; refresh images only when
    // Printful returned some (don't wipe a generated mockup gallery).
    const payload = {
      ...base,
      ...(existing.price_cents == null && priceCents != null ? { price_cents: priceCents } : {}),
      ...(images.length ? { images } : {}),
    }
    const { data, error } = await admin.from('merch').update(payload).eq('id', existing.id).select('id').single()
    if (error) throw new Error(error.message)
    return data.id
  }

  // New products land hidden (concept) — operator sets available after review.
  const { data, error } = await admin
    .from('merch')
    .insert({ slug: slugify(sp.name), ...base, images, price_cents: priceCents, status: 'concept' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

async function upsertVariant(admin: Admin, v: PrintfulSyncVariant, merchId: string): Promise<void> {
  const priceCents = Math.round(parseFloat(v.retail_price) * 100)
  const previewUrl = v.files.find((f) => f.type === 'preview')?.preview_url ?? v.files[0]?.preview_url ?? null
  const payload = {
    merch_id: merchId,
    printful_variant_id: v.variant_id,
    size: parseSize(v.name),
    color: parseColor(v.name),
    retail_price_cents: priceCents,
    image_url: previewUrl,
    in_stock: v.synced,
  }

  const { data: rows } = await admin
    .from('merch_variants')
    .select('id')
    .eq('printful_sync_variant_id', v.id)
    .limit(1)
  const existing = rows?.[0] ?? null

  if (existing) {
    const { error } = await admin.from('merch_variants').update(payload).eq('id', existing.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await admin.from('merch_variants').insert({ printful_sync_variant_id: v.id, ...payload })
    if (error) throw new Error(error.message)
  }
}

export interface SyncResult {
  products: number
  variants: number
  archived: number
  errors: number
}

export async function syncPrintfulToMerch(): Promise<SyncResult> {
  const admin = createAdminClient()
  const products = await getSyncProducts()

  let productsSynced = 0
  let variantsSynced = 0
  let errors = 0

  for (const product of products) {
    try {
      const detail = await getSyncProductDetail(product.id)
      const sp = detail.sync_product
      const variants = detail.sync_variants.filter((v) => v.synced && !v.is_ignored)

      // Garment mockups only (type 'preview') — keep raw print artwork out of the gallery.
      const images = [
        ...new Set(
          variants.flatMap((v) =>
            (v.files ?? []).filter((f) => f.type === 'preview' && f.preview_url).map((f) => f.preview_url),
          ),
        ),
      ]
      const variantCents = variants
        .map((v) => Math.round(parseFloat(v.retail_price) * 100))
        .filter((n) => Number.isFinite(n) && n > 0)
      const minPriceCents = variantCents.length ? Math.min(...variantCents) : null

      const merchId = await upsertMerch(admin, sp, images, minPriceCents)
      for (const v of variants) {
        await upsertVariant(admin, v, merchId)
        variantsSynced++
      }

      // Reconcile removed variants — mark out of stock (never delete; order_items FK).
      const liveVariantIds = variants.map((v) => v.id)
      if (liveVariantIds.length > 0) {
        await admin
          .from('merch_variants')
          .update({ in_stock: false })
          .eq('merch_id', merchId)
          .not('printful_sync_variant_id', 'in', `(${liveVariantIds.join(',')})`)
          .eq('in_stock', true)
      }
      productsSynced++
    } catch (err) {
      console.error(`[merch/sync] product ${product.id}:`, err)
      errors++
    }
  }

  // Reconcile deletions — soft-archive merch rows whose Printful product is gone.
  // Guarded: never mass-archive on a transient empty response.
  let archived = 0
  if (products.length > 0) {
    const liveIds = products.map((p) => p.id)
    const { data: pruned } = await admin
      .from('merch')
      .update({ status: 'discontinued', archived_at: new Date().toISOString() })
      .not('printful_sync_product_id', 'is', null)
      .not('printful_sync_product_id', 'in', `(${liveIds.join(',')})`)
      .is('archived_at', null)
      .select('id')
    archived = pruned?.length ?? 0
  }

  return { products: productsSynced, variants: variantsSynced, archived, errors }
}
