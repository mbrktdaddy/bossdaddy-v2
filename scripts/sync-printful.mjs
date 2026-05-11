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

function parseSize(variantName) {
  const m = variantName.match(/\b(XS|S|M|L|XL|2XL|3XL|4XL|5XL|One Size)\b/i)
  return m ? m[1].toUpperCase() : null
}

function parseColor(variantName) {
  const parts = variantName.split(/[\/\-]/).map((s) => s.trim())
  const sizePattern = /^(XS|S|M|L|XL|2XL|3XL|4XL|5XL|One Size|\d+)$/i
  return parts.find((p) => p.length > 0 && !sizePattern.test(p)) ?? null
}

async function syncMerch(sp) {
  // Check if row already exists by Printful product ID
  const { data: existing } = await supabase
    .from('merch')
    .select('id, slug')
    .eq('printful_sync_product_id', sp.id)
    .maybeSingle()

  const slug = existing?.slug ?? slugify(sp.name)
  const payload = {
    name: sp.name,
    printful_sync_product_id: sp.id,
    default_image_url: sp.thumbnail_url,
    status: 'available',
    currency: 'USD',
    archived_at: null,
  }

  if (existing) {
    const { data, error } = await supabase
      .from('merch')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('merch')
      .insert({ slug, ...payload })
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

      const merchRow = await syncMerch(sp)

      for (const v of variants) {
        await syncVariant(v, merchRow.id)
        variantsSynced++
      }

      console.log(`  ✓ "${sp.name}"  (${variants.length} variant(s))`)
      productsSynced++
    } catch (err) {
      console.error(`  ✗ product ${product.id}: ${err.message}`)
      errors++
    }
  }

  console.log(`\nDone: ${productsSynced} product(s), ${variantsSynced} variant(s) synced.`)

  if (errors > 0) {
    console.error(`${errors} error(s) — check output above.`)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
