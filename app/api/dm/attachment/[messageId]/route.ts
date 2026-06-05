// GET /api/dm/attachment/[messageId] — participant-gated image proxy.
//
// The dm-media bucket is private, so attachments have no public URL. This route
// is the only read path: it selects the message with the caller's RLS-bound
// client (messages_read only returns rows in conversations the caller belongs
// to), then mints a short-lived signed URL with the admin client and 302s to
// it. Used as the <img src> for every DM image — works the same for the SSR'd
// initial messages and for realtime-appended ones (no pre-signing needed).

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

const SIGNED_URL_TTL = 60 * 60 // 1 hour
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteCtx = { params: Promise<{ messageId: string }> }

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { messageId } = await ctx.params
  if (!UUID_RE.test(messageId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS: this returns a row only if the caller is a participant of the
  // message's conversation. A non-participant gets null → 404.
  const { data: msg } = await supabase
    .from('messages')
    .select('attachment_path')
    .eq('id', messageId)
    .maybeSingle()
  if (!msg?.attachment_path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('dm-media')
    .createSignedUrl(msg.attachment_path, SIGNED_URL_TTL)
  if (error || !data?.signedUrl) {
    console.error('DM attachment sign error:', error)
    return NextResponse.json({ error: 'Could not load image' }, { status: 502 })
  }

  // Don't cache the redirect itself — the signed URL expires. The browser still
  // caches the actual image bytes under the signed URL until it rotates.
  return NextResponse.redirect(data.signedUrl, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
