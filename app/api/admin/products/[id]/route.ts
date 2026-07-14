import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { notifyWishlistSubscribers } from '@/lib/wishlist-emails'
import { ProductUpdateSchema } from '@/lib/products/schema'

// GET /api/admin/products/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ product: data })
}

// PATCH /api/admin/products/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = ProductUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // `tags` is not a products column — it's the product_tags join (mig 122).
  // Pull it out so it doesn't land in the column update, and handle it as a
  // set-replace below. undefined = leave tags untouched; [] = clear all.
  const { tags, ...columnFields } = parsed.data

  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(columnFields)) {
    if (v !== undefined) updates[k] = v
  }
  if (Object.keys(updates).length === 0 && tags === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Replace the tag set atomically when tags were provided.
  if (tags !== undefined) {
    await admin.from('product_tags').delete().eq('product_id', id)
    if (tags.length > 0) {
      const { error: tagErr } = await admin
        .from('product_tags')
        .insert(tags.map((tag_slug) => ({ product_id: id, tag_slug })))
      if (tagErr) console.error('Product tag replace failed:', tagErr)
    }
  }

  // Capture the prior status so we can notify bench subscribers on a forward
  // transition (was handled by the retired wishlist PATCH).
  const { data: prev } = await admin.from('products').select('status').eq('id', id).single()
  const oldStatus = prev?.status as string | undefined

  // Tags-only edit: `updates` is empty, so skip the column write (an empty
  // .update() is invalid) and just re-read the row for the response.
  const hasColumnUpdates = Object.keys(updates).length > 0
  const { data, error } = hasColumnUpdates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? await admin.from('products').update(updates as any).eq('id', id).select().single()
    : await admin.from('products').select('*').eq('id', id).single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  // Notify bench subscribers on a forward transition to 'queued' or 'testing'.
  // The 'reviewed' transition is handled when a review is approved (it carries
  // the review slug), so it's intentionally excluded here.
  const newStatus = (data as { status?: string })?.status
  if (oldStatus && newStatus && oldStatus !== newStatus && (newStatus === 'queued' || newStatus === 'testing')) {
    after(async () => {
      try {
        await notifyWishlistSubscribers({ itemId: id, status: newStatus })
      } catch (err) {
        console.error('Bench status notification failed:', err)
      }
    })
  }

  // Flush every review that references this product so updated
  // URLs / images / names appear without waiting for the ISR window
  const productSlug = (data as { slug?: string })?.slug
  if (productSlug) {
    const { data: reviews } = await admin
      .from('reviews')
      .select('slug')
      .eq('product_slug', productSlug)
      .eq('status', 'approved')
    for (const r of reviews ?? []) revalidatePath(`/reviews/${r.slug}`)
  }

  return NextResponse.json({ product: data })
}

// DELETE /api/admin/products/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()

  // Full cleanup of the product's images. media_assets.product_id is ON DELETE
  // SET NULL, and a primary row may not go null (CHECK media_primary_requires_
  // product, mig 022) — so the cascade would 500 on any product with a primary
  // image. Instead we delete the product's media rows AND their storage objects
  // up front, so nothing is orphaned in the table or the bucket.
  const { data: media } = await admin
    .from('media_assets')
    .select('bucket, filename')
    .eq('product_id', id)

  if (media && media.length > 0) {
    // Remove storage objects, grouped by bucket. Best-effort: an orphaned file
    // is far less bad than a product that can't be deleted, so a storage hiccup
    // is logged, not fatal.
    const byBucket = new Map<string, string[]>()
    for (const m of media) {
      if (!m.bucket || !m.filename) continue
      const paths = byBucket.get(m.bucket) ?? []
      paths.push(m.filename)
      byBucket.set(m.bucket, paths)
    }
    for (const [bucket, paths] of byBucket) {
      const { error: storageErr } = await admin.storage.from(bucket).remove(paths)
      if (storageErr) console.warn(`Product ${id} delete — storage cleanup failed for bucket "${bucket}":`, storageErr.message)
    }

    const { error: mediaErr } = await admin.from('media_assets').delete().eq('product_id', id)
    if (mediaErr) {
      return NextResponse.json({ error: `Delete failed (media cleanup): ${mediaErr.message}` }, { status: 500 })
    }
  }

  const { error } = await admin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}
