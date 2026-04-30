import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const PatchSchema = z.object({
  alt_text:   z.string().max(300).nullable().optional(),
  label:      z.string().max(80).nullable().optional(),
  is_primary: z.boolean().optional(),
  product_id: z.string().uuid().nullable().optional(),
})

// PATCH /api/media/[id] — update alt_text, label, is_primary, product_id
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()

  const { data: asset } = await admin
    .from('media_assets')
    .select('*')
    .eq('id', id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isOwner = asset.uploaded_by === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { is_primary, ...rest } = parsed.data
  const productId: string | null = parsed.data.product_id !== undefined
    ? parsed.data.product_id
    : asset.product_id

  if (is_primary === true) {
    if (!productId) return NextResponse.json({ error: 'is_primary requires a product_id' }, { status: 400 })

    // Clear existing primary for this product
    await admin
      .from('media_assets')
      .update({ is_primary: false })
      .eq('product_id', productId)
      .eq('is_primary', true)

    const updates: Record<string, unknown> = { is_primary: true, ...pickDefined(rest) }
    await admin.from('media_assets').update(updates).eq('id', id)

    // Sync products.image_url
    await admin.from('products').update({ image_url: asset.url }).eq('id', productId)
  } else {
    const updates = pickDefined({ ...rest, ...(is_primary === false ? { is_primary: false } : {}) })
    if (Object.keys(updates).length > 0) {
      await admin.from('media_assets').update(updates).eq('id', id)
    }
  }

  const { data: updated } = await admin
    .from('media_assets')
    .select('id, url, filename, alt_text, product_id, label, is_primary, position')
    .eq('id', id)
    .single()

  return NextResponse.json({ asset: updated })
}

// DELETE /api/media/[id]
// Without ?confirm=true: blocks with 409 + usage payload if asset is referenced as a hero image.
// With ?confirm=true: cascade-nulls all hero image_url references, then deletes.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const confirm = new URL(request.url).searchParams.get('confirm') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: asset } = await admin
    .from('media_assets')
    .select('url, filename, bucket, uploaded_by, product_id, is_primary')
    .eq('id', id)
    .single()

  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const isOwner = asset.uploaded_by === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!confirm) {
    // Fast hero-ref check (exact match only — body refs can't be auto-fixed so don't block)
    const [productRefs, articleRefs, reviewRefs] = await Promise.all([
      admin.from('products').select('id, name, slug', { count: 'exact' }).eq('image_url', asset.url),
      admin.from('guides').select('id, title, slug, status', { count: 'exact' }).eq('image_url', asset.url),
      admin.from('reviews').select('id, title, slug, status', { count: 'exact' }).eq('image_url', asset.url),
    ])
    const totalHeroRefs =
      (productRefs.count ?? 0) + (articleRefs.count ?? 0) + (reviewRefs.count ?? 0)

    if (totalHeroRefs > 0) {
      // Fetch body refs too so the UI can display a full picture
      const [articleBodyRefs, reviewBodyRefs] = await Promise.all([
        admin.from('guides').select('id, title, slug, status')
          .neq('image_url', asset.url).ilike('content', `%${asset.url}%`),
        admin.from('reviews').select('id, title, slug, status')
          .neq('image_url', asset.url).ilike('content', `%${asset.url}%`),
      ])
      return NextResponse.json({
        error: 'Asset is referenced elsewhere. Re-send with ?confirm=true to cascade-clear and delete.',
        usage: {
          products:       productRefs.data    ?? [],
          guides_hero:  articleRefs.data    ?? [],
          reviews_hero:   reviewRefs.data     ?? [],
          articles_body:  articleBodyRefs.data ?? [],
          reviews_body:   reviewBodyRefs.data  ?? [],
        },
      }, { status: 409 })
    }
  }

  // Cascade-null all hero references before deleting
  if (confirm) {
    await Promise.all([
      admin.from('guides').update({ image_url: null }).eq('image_url', asset.url),
      admin.from('reviews').update({ image_url: null }).eq('image_url', asset.url),
      // products.image_url handled below via primary-promotion logic
    ])
  }

  // Delete from storage
  const { error: storageError } = await admin.storage
    .from(asset.bucket)
    .remove([asset.filename])

  if (storageError) {
    console.error('Media storage delete error:', storageError)
    return NextResponse.json({ error: 'Storage delete failed' }, { status: 502 })
  }

  await admin.from('media_assets').delete().eq('id', id)

  // Primary-promotion handles products.image_url correctly for both confirm and normal paths
  if (asset.is_primary && asset.product_id) {
    const { data: next } = await admin
      .from('media_assets')
      .select('id, url')
      .eq('product_id', asset.product_id)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (next) {
      await admin.from('media_assets').update({ is_primary: true }).eq('id', next.id)
      await admin.from('products').update({ image_url: next.url }).eq('id', asset.product_id)
    } else {
      await admin.from('products').update({ image_url: null }).eq('id', asset.product_id)
    }
  } else if (confirm) {
    // Not the gallery primary, but may still be the manual products.image_url — cascade null it
    await admin.from('products').update({ image_url: null }).eq('image_url', asset.url)
  }

  return NextResponse.json({ success: true })
}

function pickDefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}
