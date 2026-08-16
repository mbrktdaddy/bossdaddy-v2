// Family-member photo — scoped to one of the current user's kid_profiles rows.
// Re-encodes to 256×256 WebP and stores at `{kidId}/avatar.webp` in the PRIVATE
// `family-photos` bucket (migration 151).
//
// These were previously public: the bucket was `avatars`, which is public=true
// with an unconditional anonymous read policy, so a photograph of someone's
// child sat at a stable URL readable by anyone (audit #23). The bucket now has
// no read policy at all — the only way to see an image is GET on this route,
// which re-checks ownership and 302s to a short-lived signed URL. Same shape as
// /api/dm/attachment/[messageId].
//
// Tier rule unchanged: authenticated only. Anonymous cookie identity isn't
// durable enough to attach storage objects to.

import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toStorageBody } from '@/lib/storage-body'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const BUCKET = 'family-photos'
// Long enough to survive a slow image load, short enough that a leaked URL
// stops working quickly. Matches the DM attachment proxy.
const SIGNED_URL_TTL_SECONDS = 60

type RouteCtx = { params: Promise<{ id: string }> }

async function authorizeKid(kidId: string) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: 'Unauthorized' as const, status: 401 }
  if (!UUID_RE.test(kidId)) return { error: 'Invalid kid id' as const, status: 400 }

  // The `user_id` filter is the ownership gate — RLS backs it up, but this
  // makes the intent explicit and turns someone else's id into a 404 rather
  // than an empty result.
  const { data: kid } = await supabase.from('kid_profiles')
    .select('id, user_id, photo_path')
    .eq('id', kidId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!kid) return { error: 'Not found' as const, status: 404 }

  return { user, kid, supabase }
}

/** Remove every object under a family member's folder. */
async function clearFolder(admin: ReturnType<typeof createAdminClient>, kidId: string) {
  const { data: existing } = await admin.storage.from(BUCKET).list(kidId)
  if (existing && existing.length > 0) {
    await admin.storage.from(BUCKET).remove(existing.map((f) => `${kidId}/${f.name}`))
  }
}

// GET — owner-gated read. Mints a signed URL and redirects; the image bytes
// never pass through this function.
export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id: kidId } = await ctx.params
  const auth = await authorizeKid(kidId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { kid } = auth
  if (!kid.photo_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(kid.photo_path, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    console.error('family photo signed-url failed:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // `private` so the redirect is never held by a shared cache — the signed URL
  // it points at is a bearer credential with a 60s life.
  return NextResponse.redirect(data.signedUrl, {
    headers: { 'Cache-Control': 'private, max-age=0, must-revalidate' },
  })
}

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { id: kidId } = await ctx.params
  const auth = await authorizeKid(kidId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { user, supabase } = auth

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Photo must be a JPEG, PNG, or WebP' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Photo must be 10 MB or smaller' }, { status: 400 })
  }

  const raw = Buffer.from(await file.arrayBuffer())
  let buffer: Buffer
  try {
    // sharp.rotate() honors EXIF orientation; subsequent operations strip
    // metadata by default (no GPS bleed). 256×256 cover-cropped via attention
    // matches the user-avatar pipeline.
    buffer = await sharp(raw)
      .rotate()
      .resize({ width: 256, height: 256, fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    return NextResponse.json({ error: 'Could not process photo' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Wipe prior files so we don't accumulate orphans across extensions.
  await clearFolder(admin, kidId)

  const path = `${kidId}/avatar.webp`
  const { error: uploadErr } = await admin.storage.from(BUCKET).upload(path, toStorageBody(buffer, 'image/webp'), {
    contentType: 'image/webp',
    upsert: true,
  })
  if (uploadErr) {
    console.error('family photo upload failed:', uploadErr)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { error: updateErr } = await supabase
    .from('kid_profiles')
    .update({ photo_path: path })
    .eq('id', kidId)
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('family photo profile update failed:', updateErr)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  // The client renders the proxy route, not a storage URL. Cache-bust so an
  // overwritten photo shows immediately despite an identical path.
  return NextResponse.json({ photo_url: `/api/kids/${kidId}/photo?v=${Date.now()}` })
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const { id: kidId } = await ctx.params
  const auth = await authorizeKid(kidId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { user, supabase } = auth

  await clearFolder(createAdminClient(), kidId)

  const { error: updateErr } = await supabase
    .from('kid_profiles')
    .update({ photo_path: null })
    .eq('id', kidId)
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('family photo delete profile update failed:', updateErr)
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
