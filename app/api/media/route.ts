import { NextResponse, type NextRequest } from 'next/server'
import { normalizeImage } from '@/lib/images/normalize'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toStorageBody } from '@/lib/storage-body'
import { parseUploadOrigin } from '@/lib/media/origin'
import { revalidateProductPaths } from '@/lib/revalidate'

const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB

// GET /api/media — paginated list for library/picker
// ?product_id=<uuid>   filter to a specific product's images
//   '__none__'        — unassigned only
// ?category=<slug>    filter by editorial category (e.g. 'grilling')
//   '__none__'        — uncategorized only
// ?page=<n>            pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
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
  const category  = searchParams.get('category')   ?? null
  // Filter to images belonging to a specific guide/review (see migration 114).
  const sourceType = searchParams.get('source_type') ?? null
  const sourceId   = searchParams.get('source_id')   ?? null
  const limit = 40
  const offset = (page - 1) * limit

  const admin = createAdminClient()

  let query = admin
    .from('media_assets')
    .select(
      'id, url, filename, alt_text, uploaded_by, file_size, mime_type, created_at, product_id, label, is_primary, position, category, tags, origin, origin_url, profiles(username)',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (productId === '__none__') {
    query = query.is('product_id', null)
  } else if (productId) {
    query = query.eq('product_id', productId)
  }

  if (category === '__none__') {
    query = query.is('category', null)
  } else if (category) {
    query = query.eq('category', category)
  }

  if (sourceType && sourceId) {
    query = query.eq('source_type', sourceType).eq('source_id', sourceId)
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
  const { user } = await getUserSafe(supabase)
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
  const category = (formData.get('category') as string | null)?.trim() || null
  const tagsRaw = (formData.get('tags') as string | null)?.trim() || ''
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []
  const mediaOrigin = parseUploadOrigin(formData.get('origin'), formData.get('origin_url'))

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

  const folder = productId ? `products/${productId}` : 'general'
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`

  const admin = createAdminClient()
  const rawBuffer = Buffer.from(await file.arrayBuffer())

  let buffer: Buffer
  try {
    const result = await normalizeImage(rawBuffer)
    buffer = result.buffer
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not process image — file may be corrupt'
    const status = (err as { status?: number }).status ?? 400
    return NextResponse.json({ error: msg }, { status })
  }

  const { error: uploadError } = await admin.storage
    .from('media')
    .upload(filename, toStorageBody(buffer, 'image/webp'), { contentType: 'image/webp', upsert: false })

  if (uploadError) {
    console.error('Media upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 502 })
  }

  const { data: { publicUrl } } = admin.storage.from('media').getPublicUrl(filename)

  // Position, the first-image-is-primary rule, demoting the old primary and the
  // product's hero are the database's job (mig 162): it serialises a product's
  // uploads, so parallel uploads can't race "count + 1" into several primaries.
  const { data: asset, error: dbError } = await admin
    .from('media_assets')
    .insert({
      url: publicUrl,
      bucket: 'media',
      filename,
      alt_text: altText || null,
      uploaded_by: user.id,
      file_size: buffer.length,
      mime_type: 'image/webp',
      product_id: productId,
      label,
      is_primary: isPrimary,
      category,
      tags,
      origin: mediaOrigin.origin,
      origin_url: mediaOrigin.origin_url,
    })
    .select('id, url, filename, alt_text, uploaded_by, file_size, mime_type, created_at, product_id, label, is_primary, position, category, tags, origin, origin_url')
    .single()

  if (dbError) {
    console.error('Media DB insert error:', dbError)
    return NextResponse.json({ error: 'Upload succeeded but metadata save failed' }, { status: 500 })
  }

  // A product image changes its public gallery (mig 161) and maybe its hero.
  if (productId) revalidateProductPaths()

  return NextResponse.json({ asset }, { status: 201 })
}
