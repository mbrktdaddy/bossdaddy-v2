import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchProductImages } from '@/lib/amazon-pa-api'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()

  const accessKey  = process.env.AMAZON_PA_API_ACCESS_KEY
  const secretKey  = process.env.AMAZON_PA_API_SECRET_KEY
  const partnerTag = process.env.AMAZON_ASSOCIATE_TAG

  if (!accessKey || !secretKey || !partnerTag) {
    return NextResponse.json(
      { error: 'PA_API_NOT_CONFIGURED', message: 'PA-API credentials not set. Available after 3 qualifying sales on your Associates account.' },
      { status: 503 },
    )
  }

  const { id } = await params
  const admin = createAdminClient()

  const { data: product } = await admin
    .from('products')
    .select('id, name, asin')
    .eq('id', id)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }
  if (!product.asin) {
    return NextResponse.json({ error: 'Product has no ASIN — set it first.' }, { status: 400 })
  }

  let paImages
  try {
    paImages = await fetchProductImages(product.asin, accessKey, secretKey, partnerTag)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'PA-API request failed' },
      { status: 502 },
    )
  }

  if (paImages.length === 0) {
    return NextResponse.json({ error: 'No images returned for this ASIN.' }, { status: 404 })
  }

  // Clear existing primary for this product before importing
  await admin
    .from('media_assets')
    .update({ is_primary: false })
    .eq('product_id', id)
    .eq('is_primary', true)

  const imported: string[] = []
  let primaryUrl: string | null = null

  for (let i = 0; i < paImages.length; i++) {
    const img      = paImages[i]
    const isPrimary = i === 0

    try {
      const imgRes = await fetch(img.url)
      if (!imgRes.ok) continue

      const buffer   = Buffer.from(await imgRes.arrayBuffer())
      const ext      = img.url.toLowerCase().includes('.png') ? 'png' : 'jpg'
      const filename = `amazon-${product.asin}-${i}.${ext}`
      const path     = `products/${id}/${Date.now()}-${i}-${filename}`
      const mime     = ext === 'png' ? 'image/png' : 'image/jpeg'

      const { error: uploadError } = await admin.storage
        .from('media')
        .upload(path, buffer, { contentType: mime, upsert: false })

      if (uploadError) continue

      const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(path)

      const { error: assetError } = await admin.from('media_assets').insert({
        url:        publicUrl,
        bucket:     'media',
        filename,
        alt_text:   product.name,
        product_id: id,
        label:      isPrimary ? 'primary' : `variant-${i}`,
        is_primary: isPrimary,
        position:   i + 1,
        file_size:  buffer.length,
        mime_type:  mime,
      })

      if (assetError) continue

      imported.push(publicUrl)
      if (isPrimary) primaryUrl = publicUrl
    } catch {
      continue
    }
  }

  if (primaryUrl) {
    await admin.from('products').update({ image_url: primaryUrl }).eq('id', id)
  }

  return NextResponse.json({ imported: imported.length, images: imported })
}
