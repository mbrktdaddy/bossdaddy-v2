// Usage: npm run merch:sync
// Pulls synced products from Printful and upserts merch + merch_variants in Supabase.
// Idempotent — safe to re-run after every design update in Printful.

import { createClient } from '@supabase/supabase-js'

const PRINTFUL_API = 'https://api.printful.com'

const printfulKey = process.env.PRINTFUL_API_KEY
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!printfulKey) throw new Error('PRINTFUL_API_KEY not set in .env.local')
if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set in .env.local')
if (!supabaseKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set in .env.local')

const supabase = createClient(supabaseUrl, supabaseKey)

async function pf(path) {
  const res = await fetch(`${PRINTFUL_API}${path}`, {
    headers: { Authorization: `Bearer ${printfulKey}` },
  })
  if (!res.ok) {
    throw new Error(`Printful GET ${path} → ${res.status}: ${await res.text()}`)
  }
  const json = await res.json()
  return json.result
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Printful names sync variants as "Product Name / Color / Size" (color and/or
// size segments are optional). Split ONLY on "/" — splitting on "-" too would
// shred the product name (e.g. "Boss Daddy- Read the directions…") and mis-read
// the color. The size is the last segment when it matches a size token; the
// color is whatever sits between the product name and the size.
const SIZE_TOKEN = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|XXL|XXXL|One Size|OS)$/i

function variantSegments(variantName) {
  return variantName.split('/').map((s) => s.trim()).filter(Boolean)
}

function parseSize(variantName) {
  const parts = variantSegments(variantName)
  const last = parts[parts.length - 1]
  return last && SIZE_TOKEN.test(last) ? last : null
}

function parseColor(variantName) {
  const parts = variantSegments(variantName)
  if (parts.length < 2) return null
  const last = parts[parts.length - 1]
  // Drop the product name (first segment) and the trailing size (if present).
  const colorParts = parts.slice(1, SIZE_TOKEN.test(last) ? -1 : undefined)
  return colorParts.length ? colorParts.join(' / ') : null
}

async function syncMerch(sp, images = [], priceCents = null) {
  // Check if row already exists by Printful product ID
  const { data: existing } = await supabase
    .from('merch')
    .select('id, slug, price_cents')
    .eq('printful_sync_product_id', sp.id)
    .maybeSingle()

  const slug = existing?.slug ?? slugify(sp.name)

  // Fields that are always safe to refresh from Printful.
  const base = {
    name: sp.name,
    printful_sync_product_id: sp.id,
    default_image_url: sp.thumbnail_url,
    currency: 'USD',
    archived_at: null,
  }

  if (existing) {
    // Preserve operator decisions on re-sync:
    //  - do NOT touch `status` (else hiding/curating a product is undone, and
    //    freshly-published items would be forced public before approval)
    //  - only set `price_cents` if the operator hasn't (Printful is the source,
    //    but don't clobber a manual override)
    //  - only refresh `images` when Printful actually returned mockups, so a
    //    generated mockup gallery isn't wiped by an API product's empty set
    const payload = { ...base }
    if (existing.price_cents == null && priceCents != null) payload.price_cents = priceCents
    if (images.length) payload.images = images

    const { data, error } = await supabase
      .from('merch')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  } else {
    // New products land HIDDEN (concept) — the operator sets them available in
    // Merch admin after reviewing. Never auto-publish a fresh sync.
    const { data, error } = await supabase
      .from('merch')
      .insert({ slug, ...base, images, price_cents: priceCents, status: 'concept' })
      .select('id')
      .single()
    if (error) throw error
    return data
  }
}

async function syncVariant(v, merchId) {
  const priceCents = Math.round(parseFloat(v.retail_price) * 100)
  const previewUrl =
    v.files.find((f) => f.type === 'preview')?.preview_url ??
    v.files[0]?.preview_url ??
    null

  const payload = {
    merch_id: merchId,
    printful_variant_id: v.variant_id,
    size: parseSize(v.name),
    color: parseColor(v.name),
    retail_price_cents: priceCents,
    image_url: previewUrl,
    in_stock: v.synced,
  }

  // limit(1) handles edge case where duplicate rows exist (maybeSingle errors silently on >1 rows)
  const { data: rows } = await supabase
    .from('merch_variants')
    .select('id')
    .eq('printful_sync_variant_id', v.id)
    .limit(1)

  const existing = rows?.[0] ?? null

  if (existing) {
    const { error } = await supabase
      .from('merch_variants')
      .update(payload)
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('merch_variants')
      .insert({ printful_sync_variant_id: v.id, ...payload })
    if (error) throw error
  }
}

async function run() {
  console.log('Fetching products from Printful…')
  const products = await pf('/store/products')
  console.log(`Found ${products.length} synced product(s)\n`)

  let productsSynced = 0
  let variantsSynced = 0
  let errors = 0

  for (const product of products) {
    try {
      const detail = await pf(`/store/products/${product.id}`)
      const sp = detail.sync_product
      const variants = detail.sync_variants.filter((v) => v.synced && !v.is_ignored)

      // Collect garment mockups only. Each variant's `files` mixes PRINT files
      // (type 'front_large', 'label_outside', placement names, etc.) whose
      // preview_url is the raw artwork, with the rendered mockup (type
      // 'preview'). Take only 'preview' — otherwise the design source images
      // leak into the product gallery. Dedup yields one mockup per color.
      const images = [...new Set(
        variants.flatMap((v) =>
          (v.files ?? [])
            .filter((f) => f.type === 'preview' && f.preview_url)
            .map((f) => f.preview_url)
        )
      )]

      // Denormalized "from" price for list cards (detail computes the full range
      // from variants). Min retail across synced variants.
      const variantCents = variants
        .map((v) => Math.round(parseFloat(v.retail_price) * 100))
        .filter((n) => Number.isFinite(n) && n > 0)
      const minPriceCents = variantCents.length ? Math.min(...variantCents) : null

      const merchRow = await syncMerch(sp, images, minPriceCents)

      for (const v of variants) {
        await syncVariant(v, merchRow.id)
        variantsSynced++
      }

      // Reconcile removed variants — e.g. a size dropped from the product in
      // Printful. We mark them out of stock rather than delete: order_items
      // FK-reference merch_variants, so a hard delete of a previously-ordered
      // variant would fail. in_stock=false makes them unbuyable (cart-add
      // rejects out-of-stock, and the option renders disabled), which is the
      // goal — buying a variant Printful no longer has would fail at fulfillment.
      const liveVariantIds = variants.map((v) => v.id)
      if (liveVariantIds.length > 0) {
        const { data: staleVars, error: varErr } = await supabase
          .from('merch_variants')
          .update({ in_stock: false })
          .eq('merch_id', merchRow.id)
          .not('printful_sync_variant_id', 'in', `(${liveVariantIds.join(',')})`)
          .eq('in_stock', true)
          .select('id')
        if (varErr) {
          console.error(`    ✗ variant reconcile failed: ${varErr.message}`)
          errors++
        } else if (staleVars?.length) {
          console.log(`    ⤵ marked ${staleVars.length} removed variant(s) out of stock`)
        }
      }

      console.log(`  ✓ "${sp.name}"  (${variants.length} variant(s))`)
      productsSynced++
    } catch (err) {
      console.error(`  ✗ product ${product.id}: ${err.message}`)
      errors++
    }
  }

  // ── Reconcile deletions ──────────────────────────────────────────────────
  // Printful only reports what currently exists, so the upsert loop above can
  // never remove a product that was deleted upstream. Any merch row linked to a
  // Printful product that's no longer in the store is stale — soft-delete it by
  // stamping archived_at (display queries already filter `archived_at is null`).
  // A product that reappears in Printful is un-archived on the next run
  // (syncMerch resets archived_at:null); its status is left as-is for the
  // operator to re-set, so nothing is silently re-published.
  let archived = 0
  if (products.length === 0) {
    console.warn(
      '\n⚠ Printful returned 0 products — skipping deletion reconcile so a ' +
      'transient empty response can\'t mass-archive the whole store. ' +
      'Re-run if your store really is empty.'
    )
  } else {
    const liveIds = products.map((p) => p.id)
    const { data: pruned, error: pruneErr } = await supabase
      .from('merch')
      .update({ status: 'discontinued', archived_at: new Date().toISOString() })
      .not('printful_sync_product_id', 'is', null)
      .not('printful_sync_product_id', 'in', `(${liveIds.join(',')})`)
      .is('archived_at', null)
      .select('name')
    if (pruneErr) {
      console.error(`  ✗ deletion reconcile failed: ${pruneErr.message}`)
      errors++
    } else {
      archived = pruned?.length ?? 0
      for (const row of pruned ?? []) {
        console.log(`  ⤵ archived "${row.name}" (no longer in Printful)`)
      }
    }
  }

  console.log(
    `\nDone: ${productsSynced} product(s), ${variantsSynced} variant(s) synced` +
    `${archived > 0 ? `, ${archived} stale product(s) archived` : ''}.`
  )

  if (errors > 0) {
    console.error(`${errors} error(s) — check output above.`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
