// Kid avatar upload — mirrors /api/profile/avatar but scoped to one of
// the current user's kid_profiles rows. Re-encodes to 256×256 WebP and
// stores at `kids/{kidId}/avatar.webp` inside the existing `avatars`
// bucket. Tier rule: authenticated only (anonymous can't upload — the
// cookie identity isn't durable enough to attach storage objects to).

import { NextResponse, type NextRequest } from 'next/server'
import sharp from 'sharp'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 10 * 1024 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteCtx = { params: Promise<{ id: string }> }

async function authorizeKid(kidId: string) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: 'Unauthorized' as const, status: 401 }
  if (!UUID_RE.test(kidId)) return { error: 'Invalid kid id' as const, status: 400 }

  const { data: kid } = await supabase.from('kid_profiles')
    .select('id, user_id, photo_url')
    .eq('id', kidId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!kid) return { error: 'Kid not found' as const, status: 404 }

  return { user, kid, supabase }
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
  const folder = `kids/${kidId}`

  // Wipe prior files so we don't accumulate orphans across extensions.
  const { data: existing } = await admin.storage.from('avatars').list(folder)
  if (existing && existing.length > 0) {
    await admin.storage.from('avatars').remove(
      existing.map((f) => `${folder}/${f.name}`),
    )
  }

  const path = `${folder}/avatar.webp`
  const { error: uploadErr } = await admin.storage.from('avatars').upload(path, buffer, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (uploadErr) {
    console.error('kid photo upload failed:', uploadErr)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the new image shows immediately even when the URL
  // string is identical (overwritten file).
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updateErr } = await supabase
    .from('kid_profiles')
    .update({ photo_url: publicUrl })
    .eq('id', kidId)
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('kid photo profile update failed:', updateErr)
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }

  return NextResponse.json({ photo_url: publicUrl })
}

export async function DELETE(_request: NextRequest, ctx: RouteCtx) {
  const { id: kidId } = await ctx.params
  const auth = await authorizeKid(kidId)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const { user, supabase } = auth

  const admin = createAdminClient()
  const folder = `kids/${kidId}`
  const { data: existing } = await admin.storage.from('avatars').list(folder)
  if (existing && existing.length > 0) {
    await admin.storage.from('avatars').remove(
      existing.map((f) => `${folder}/${f.name}`),
    )
  }

  const { error: updateErr } = await supabase
    .from('kid_profiles')
    .update({ photo_url: null })
    .eq('id', kidId)
    .eq('user_id', user.id)
  if (updateErr) {
    console.error('kid photo delete profile update failed:', updateErr)
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
