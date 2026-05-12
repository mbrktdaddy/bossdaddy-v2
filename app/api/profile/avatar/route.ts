import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 2 * 1024 * 1024  // 2 MB — matches bucket file_size_limit

// POST /api/profile/avatar
// Multipart form: { file: File }
// Replaces any existing avatar for the current user. Returns the new public URL.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Avatar must be a JPEG, PNG, or WebP image' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Avatar must be 2 MB or smaller' }, { status: 400 })
  }

  // Derive extension from MIME to ignore filename trickery
  const ext = file.type === 'image/jpeg' ? 'jpg'
    : file.type === 'image/png'  ? 'png'
    : 'webp'

  const admin = createAdminClient()
  const userFolder = user.id

  // Wipe any prior file(s) in this user's folder so we don't accumulate orphans
  // when extension changes (jpg → png) or a previous upload partially failed.
  const { data: existing } = await admin.storage.from('avatars').list(userFolder)
  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${userFolder}/${f.name}`)
    await admin.storage.from('avatars').remove(paths)
  }

  const path = `${userFolder}/avatar.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadErr } = await admin.storage.from('avatars').upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (uploadErr) {
    console.error('avatar upload failed:', uploadErr)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const { data: pub } = admin.storage.from('avatars').getPublicUrl(path)
  // Cache-bust so the new image shows immediately even when the URL string
  // is identical to the previous one (overwritten file).
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl } as never)
    .eq('id', user.id)
  if (updateErr) {
    console.error('avatar profile update failed:', updateErr)
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ avatar_url: publicUrl })
}

// DELETE /api/profile/avatar
// Removes the current user's avatar file and clears profiles.avatar_url.
export async function DELETE() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const userFolder = user.id

  const { data: existing } = await admin.storage.from('avatars').list(userFolder)
  if (existing && existing.length > 0) {
    const paths = existing.map((f) => `${userFolder}/${f.name}`)
    await admin.storage.from('avatars').remove(paths)
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ avatar_url: null } as never)
    .eq('id', user.id)
  if (updateErr) {
    console.error('avatar delete profile update failed:', updateErr)
    return NextResponse.json({ error: 'Profile update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
