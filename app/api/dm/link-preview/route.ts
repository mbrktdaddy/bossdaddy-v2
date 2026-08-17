// POST /api/dm/link-preview — unfurl a URL a member shared, server-side.
//
// The client asks for this after render, for links the thread's cache lookup
// missed. It is a POST because it has a side effect (an outbound fetch and a cache
// write), and it is authenticated because it makes OUR INFRASTRUCTURE fetch a URL
// somebody typed — which is the whole reason lib/link-preview/net-guard.ts exists.
//
// ── WHY THE FAILURE RESPONSE SAYS NOTHING ────────────────────────------------
// Every refusal returns the same `{ preview: null }`. Distinguishing "blocked
// address" from "host not found" from "no metadata" would turn this endpoint into
// an internal port and host scanner with a clean JSON interface: aim it at
// 10.0.0.5, read which error comes back, and you have mapped the private network
// from outside. The reason is recorded in the row for us; the caller gets nothing.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { unfurl } from '@/lib/link-preview'

export const runtime = 'nodejs'
// Two guarded hops (page, then image) at a 5s budget each, plus a sharp re-encode.
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Per-member cap. This endpoint makes us issue outbound requests on demand, so
  // without it one account could point the site at somebody else's server as a
  // modest amplifier — and run up our own function time doing it. The cache means
  // repeat views of the same link cost nothing, so a real user never reaches this.
  const { success } = await checkRateLimit(user.id, 'link-preview')
  if (!success) return NextResponse.json({ preview: null, throttled: true }, { status: 429 })

  let url: unknown
  try {
    url = (await request.json())?.url
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (typeof url !== 'string' || !url) return NextResponse.json({ error: 'Invalid url' }, { status: 400 })

  // NOT gated on "is this URL actually in one of your conversations". It could be,
  // but the check costs a full-text scan of the caller's messages and buys little:
  // the response contains only public page metadata, the cache is keyed by URL
  // rather than by member, and nothing about who shared it is returned. The gate
  // that matters is the rate limit above and the address guard underneath.
  const preview = await unfurl(url)
  return NextResponse.json({ preview })
}
