// GET /api/link-preview/image/[id] — serve a cached link-preview thumbnail.
//
// THIS ROUTE IS THE POINT OF THE FEATURE'S ARCHITECTURE. The alternative — putting
// the third party's og:image straight into `<img src>` — makes the RECIPIENT'S
// browser fetch a URL the SENDER chose, handing the sender a read receipt plus the
// recipient's IP and user agent. Serving our own re-encoded copy from our own
// domain means the third party never learns the recipient exists.
//
// Same shape as /api/dm/attachment/[messageId]: authenticate, resolve the storage
// path server-side, mint a short-lived signed URL, redirect. The bucket is private,
// so this is the only read path.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { thumbnailPathFor } from '@/lib/link-preview'

export const runtime = 'nodejs'

const SIGNED_URL_TTL = 60 * 60 // 1 hour
// Longer than the DM attachment's 60s, and the difference is deliberate. There the
// window was bounded by revocation — a blocked member must stop seeing photos
// quickly. Here the bytes are a thumbnail of a PUBLIC web page that carries no
// private content, so there is nothing to revoke; the only reason to require a
// session at all is to keep the endpoint from being a free image CDN.
const REDIRECT_CACHE_SECONDS = 60 * 10
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type RouteCtx = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const path = await thumbnailPathFor(id)
  if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await createAdminClient().storage
    .from('dm-media')
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data?.signedUrl) {
    console.error('link preview image sign error:', error)
    return NextResponse.json({ error: 'Could not load image' }, { status: 502 })
  }

  // PRIVATE, always: a shared cache must not hold a redirect keyed to one member's
  // session, even for content that isn't itself sensitive.
  return NextResponse.redirect(data.signedUrl, {
    headers: { 'Cache-Control': `private, max-age=${REDIRECT_CACHE_SECONDS}` },
  })
}
