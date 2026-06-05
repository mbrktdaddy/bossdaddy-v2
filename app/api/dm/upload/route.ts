// POST /api/dm/upload — send an image attachment into a DM conversation.
//
// Gate is identical to sending text (migration 083): an active member who is a
// participant of the conversation, with no block in either direction. The raw
// upload is normalized server-side (auto-rotate + WebP re-encode strips
// EXIF/GPS), stored in the PRIVATE dm-media bucket via the admin client, and a
// message row is inserted carrying the storage path. Reads happen later through
// the participant-gated proxy (/api/dm/attachment/[id]) — never a public URL.
//
// One image per request, with an optional text caption stored in `body`.

import { NextResponse, type NextRequest } from 'next/server'
import { normalizeImage } from '@/lib/images/normalize'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOtherParticipants, isBlockedBetween, pushNewMessage } from '@/lib/messaging-shared'

export const runtime = 'nodejs' // sharp needs the Node runtime
export const maxDuration = 60

const ALLOWED_TYPES  = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB raw (pre-normalize)
const MAX_CAPTION    = 4000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Sign in to send messages' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const conversationId = (form.get('conversationId') as string | null)?.trim() ?? ''
  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'Invalid conversation' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Image must be under 8 MB' }, { status: 400 })
  }

  const caption = ((form.get('caption') as string | null) ?? '').trim()
  if (caption.length > MAX_CAPTION) {
    return NextResponse.json({ error: `Caption must be ${MAX_CAPTION} characters or fewer` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Participant + block gate (mirrors sendMessage). RLS would also reject the
  // insert if the sender weren't a participant, but we check here to give a
  // clean error and to enforce the block (which RLS can't see).
  const others = await getOtherParticipants(admin, conversationId, user.id)
  if (others.length === 0) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  if (await isBlockedBetween(admin, user.id, others)) {
    return NextResponse.json({ error: 'Messaging is unavailable with this user.' }, { status: 403 })
  }

  // Normalize: auto-rotate, fit within max dimension, WebP. minDimension 0 so
  // small screenshots/memes aren't rejected the way editorial photos are.
  const rawBuffer = Buffer.from(await file.arrayBuffer())
  let normalized
  try {
    normalized = await normalizeImage(rawBuffer, { minDimension: 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Could not process image — file may be corrupt'
    const status = (err as { status?: number }).status ?? 400
    return NextResponse.json({ error: msg }, { status })
  }

  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`
  const { error: uploadError } = await admin.storage
    .from('dm-media')
    .upload(path, normalized.buffer, { contentType: 'image/webp', upsert: false })
  if (uploadError) {
    console.error('DM attachment upload error:', uploadError)
    return NextResponse.json({ error: 'Upload failed — please try again' }, { status: 502 })
  }

  // RLS enforces: sender is a participant AND the account is active. If the
  // insert fails, clean up the orphaned object so the bucket doesn't leak.
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      conversation_id:   conversationId,
      sender_id:         user.id,
      body:              caption,
      attachment_path:   path,
      attachment_width:  normalized.width,
      attachment_height: normalized.height,
    })
    .select('id')
    .single()
  if (error || !msg) {
    await admin.storage.from('dm-media').remove([path])
    return NextResponse.json({ error: 'Could not send image' }, { status: 500 })
  }

  await pushNewMessage(admin, others, user.id, conversationId)

  return NextResponse.json({ id: msg.id }, { status: 201 })
}
