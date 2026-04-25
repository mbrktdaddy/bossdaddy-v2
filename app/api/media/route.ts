import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

// GET /api/media — paginated list for library/picker
// ?product_id=<uuid>  filter to a specific product's images
// ?page=<n>           pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const productId = searchParams.get('product_id') ?? null
  const limit = 40
  const offset = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('media_assets')
    .select(
      'id, url, filename, alt_text, uploaded_by, file_size, mime_type, created_at, product_id, label, is_primary, position, profiles(username)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId === '__none__') {
    query = query.is('product_id', null)
  } else if (productId) {
    query = query.eq('product_id', productId)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: 'Failed to load media' }, { status: 500 })

  return NextResponse.json({ assets: data, total: count ?? 0, page, limit })
}

// POST /api/media — upload a new asset
// FormData fields:
//   file         (required) — image file
//   alt_text     (optional)
//   product_id   (optional) — UUID, assigns to a product
//   label        (optional) — e.g. "front", "in use"
//   is_primary   (optional) — "true" to set as product primary (requires product_id)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const altText = (formData.get('alt_text') as string | null)?.trim() ?? ''
  const productId = (formData.get('product_id') as string | null)?.trim() || null
  const label = (formData.get('label') as string | null)?.trim() || null
  const isPrimary = formData.get('is_primary') === 'true'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, WebP, and GIF files are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'File must be under 8 MB' }, { status: 400 })
  }

  if (isPrimary && !productId) {
    return NextResponse.json({ error: 'is_primary requires a product_id' }, { status: 400 })
  }

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const folder = productId ? `products/${productId}` : 'general'
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const admin = createAdminClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('media')
    .upload(filename, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('Media upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 502 })
  }

  const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(filename)

  // If setting as primary, clear existing primary for this product first
  if (isPrimary && productId) {
    await admin
      .from('media_assets')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true)
  }

  // Determine position: count existing product images
  let position: number | null = null
  if (productId) {
    const { count } = await admin
      .from('media_assets')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
    position = (count ?? 0) + 1
  }

  const { data: asset, error: dbError } = await admin
    .from('media_assets')
    .insert({
      url: publicUrl,
      bucket: 'media',
      filename,
      alt_text: altText || null,
      uploaded_by: user.id,
      file_size: file.size,
      mime_type: file.type,
      product_id: productId,
      label,
      is_primary: isPrimary,
      position,
    })
    .select('id, url, filename, alt_text, uploaded_by, file_size, mime_type, created_at, product_id, label, is_primary, position')
    .single()

  if (dbError) {
    console.error('Media DB insert error:', dbError)
    return NextResponse.json({ error: 'Upload succeeded but metadata save failed' }, { status: 500 })
  }

  // Sync products.image_url if this is the primary
  if (isPrimary && productId) {
    await admin.from('products').update({ image_url: publicUrl }).eq('id', productId)
  }

  // Auto-primary: if this is the first image for the product, make it primary
  if (productId && !isPrimary && position === 1) {
    await admin.from('media_assets').update({ is_primary: true }).eq('id', asset.id)
    await admin.from('products').update({ image_url: publicUrl }).eq('id', productId)
    asset.is_primary = true
  }

  return NextResponse.json({ asset }, { status: 201 })
}
