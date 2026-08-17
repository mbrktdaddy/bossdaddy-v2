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
// ── WHY 60 SECONDS AND NOT AN HOUR ──────────────────────────────────────────
// The redirect used to be `no-store`, which meant opening a thread with twenty
// photos fired twenty function invocations and twenty sign operations, every
// single time. The cost is not repeat visits — it's the BURST on one open, and a
// one-minute private cache collapses exactly that.
//
// It is deliberately not longer, and the reason is access revocation rather than
// cost. A cached redirect keeps working for its lifetime without re-checking
// participation, so someone blocked or disconnected mid-session would still load
// images for as long as this window. Sixty seconds is short enough to be
// indistinguishable from the request already in flight; an hour would not be, and
// a day would turn "I blocked him" into a promise the system doesn't keep.
const REDIRECT_CACHE_SECONDS = 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteCtx = { params: Promise<{ messageId: string }> }

export async function GET(request: NextRequest, ctx: RouteCtx) {
  const { messageId } = await ctx.params
  if (!UUID_RE.test(messageId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ?download=1 → save instead of view. Supabase signs a Content-Disposition of
  // attachment for us, which is the only way to get a real download: a bare
  // `download` attribute on an <a> is ignored cross-origin, and the signed URL is
  // always a different origin from the app.
  const wantsDownload = new URL(request.url).searchParams.get('download') === '1'

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
    .createSignedUrl(msg.attachment_path, SIGNED_URL_TTL, {
      // A filename, not the storage path — that carries a conversation id and a
      // timestamp, neither of which belongs in someone's Downloads folder.
      ...(wantsDownload ? { download: `boss-daddy-photo-${messageId.slice(0, 8)}.webp` } : {}),
    })
  if (error || !data?.signedUrl) {
    console.error('DM attachment sign error:', error)
    return NextResponse.json({ error: 'Could not load image' }, { status: 502 })
  }

  // Cacheable for a short window (see REDIRECT_CACHE_SECONDS) and always PRIVATE
  // — a shared cache must never hold a redirect to someone's DM photo. The window
  // stays well inside SIGNED_URL_TTL so a cached redirect can't point at an
  // already-expired signature. A download is never cached: it's a one-off action.
  return NextResponse.redirect(data.signedUrl, {
    headers: {
      'Cache-Control': wantsDownload
        ? 'private, no-store'
        : `private, max-age=${REDIRECT_CACHE_SECONDS}`,
    },
  })
}
