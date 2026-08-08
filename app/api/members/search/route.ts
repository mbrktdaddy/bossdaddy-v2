// Member lookup. Finds active members by username, display name, or an EXACT
// email address, and reports where the caller stands with each of them so the UI
// can offer Message or Connect rather than guessing.
//
// THREE RULES, ALL OF THEM SECURITY:
//
// 1. EMAIL MATCHING IS EXACT, NEVER PARTIAL. `ilike '%bob%'` over addresses would
//    hand anyone a way to walk the member list; requiring the whole address means
//    you can only find someone you already know how to contact. Addresses live in
//    auth.users, so the lookup runs through the admin client — and the address is
//    NEVER echoed back in the response. Honours profiles.discoverable_by_email.
//
// 2. BLOCKED PAIRS ARE MUTUALLY INVISIBLE. This route previously returned every
//    active member with no block filtering at all, so somebody who blocked you
//    still appeared in your results and you in theirs. That was a live bug before
//    connections existed; it would be a much worse one now that a search result is
//    the start of a request.
//
// 3. RATE LIMITED. Even exact-match email lookup answers "is this address a member
//    here", which is a fact about somebody else. The cap makes walking a list of
//    addresses pointless while staying invisible to a person typing a name.

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { likePattern } from '@/lib/postgrest-escape'
import { checkRateLimit } from '@/lib/rate-limit'
import { connectionStatesFor } from '@/lib/connections'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await checkRateLimit(user.id, 'member-search')
  if (!success) return NextResponse.json({ members: [], throttled: true }, { status: 429 })

  // Forgiving of a leading @ — usernames render as @name across the UI, so
  // people instinctively type it; strip it before matching.
  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  const q = raw.replace(/^@+/, '')
  if (q.length < 2) return NextResponse.json({ members: [] })

  const ids = EMAIL_RE.test(q)
    ? await findByExactEmail(q)
    : null

  let rows: { id: string; username: string | null; display_name: string | null
              avatar_url: string | null; account_status: string | null }[] = []

  if (ids) {
    if (ids.length === 0) return NextResponse.json({ members: [] })
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, account_status, discoverable_by_email')
      .in('id', ids)
      .neq('id', user.id)
    // Opt-out honoured here rather than in the lookup so a member who turned it
    // off is indistinguishable from an address that isn't registered at all.
    rows = (data ?? []).filter((m) => m.discoverable_by_email !== false)
  } else {
    // Sanitize before interpolating into .or() — supabase-js does not
    // parameterize it, so a raw q could inject filter conditions (CWE-943).
    const like = likePattern(q)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, account_status')
      .or(`username.ilike.${like},display_name.ilike.${like}`)
      .neq('id', user.id)
      .limit(10)
    if (error) return NextResponse.json({ members: [] })
    rows = data ?? []
  }

  const active = rows.filter((m) => (m.account_status ?? 'active') === 'active')
  if (active.length === 0) return NextResponse.json({ members: [] })

  // One batched read for all of them, then drop blocked pairs entirely — a
  // blocked member should not appear with a disabled button, they should not
  // appear.
  const states = await connectionStatesFor(supabase, user.id, active.map((m) => m.id))

  const members = active
    .filter((m) => states.get(m.id) !== 'blocked')
    .map((m) => ({
      id: m.id,
      username: m.username,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      connectionState: states.get(m.id) ?? 'none',
    }))

  return NextResponse.json({ members })
}

/**
 * Exact-address lookup, admin-side. Returns user ids only — the caller never sees
 * an address, and neither does the response.
 *
 * listUsers rather than a filtered query because GoTrue's admin API has no
 * by-email filter; the member base is small enough that one page is fine. If it
 * ever isn't, this becomes an RPC over auth.users, still exact-match.
 */
async function findByExactEmail(email: string): Promise<string[]> {
  const wanted = email.toLowerCase()
  try {
    const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) return []
    return data.users.filter((u) => u.email?.toLowerCase() === wanted).map((u) => u.id)
  } catch {
    return []
  }
}
