// Bulk mark-read / delete for the /account/notifications select mode.
//
// One route, two actions. Both are ordinary session-client writes, so RLS is the
// gate — the explicit `.eq('user_id', ...)` alongside it is belt-and-braces in
// the house style (see read-all/route.ts), not the real protection.
//
// DELETE IS PARTIALLY GATED IN THE DATABASE. Migration 154 refuses to delete a
// pending actionable notification, because that row is the only place a
// connection request can be accepted. An RLS-blocked DELETE removes zero rows
// and reports NO error, so this route returns the ids Postgres actually deleted
// and lets the client reconcile against that. Reporting `ok: true` and letting
// the UI drop the row optimistically would make a blocked delete look like it
// worked until the next refetch put the row back.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// The feed reads 40 rows, so select-all can never exceed that. The cap is
// headroom against a hand-rolled request, not a product limit.
const MAX_IDS = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { ids?: unknown; action?: unknown }
  if (body.action !== 'read' && body.action !== 'delete') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: 'No notifications selected' }, { status: 400 })
  }
  if (body.ids.length > MAX_IDS) {
    return NextResponse.json({ error: 'Too many notifications' }, { status: 400 })
  }
  // Malformed ids are dropped rather than 400'd — a bad id in a batch of thirty
  // shouldn't cost the other twenty-nine their action.
  const ids = [...new Set(body.ids.filter((v): v is string => typeof v === 'string' && UUID_RE.test(v)))]
  if (ids.length === 0) return NextResponse.json({ error: 'No valid notifications' }, { status: 400 })

  if (body.action === 'read') {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .in('id', ids)
      .eq('user_id', user.id)
      .is('read_at', null)
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, read: (data ?? []).map((r) => r.id) })
  }

  const { data, error } = await supabase
    .from('notifications')
    .delete()
    .in('id', ids)
    .eq('user_id', user.id)
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const deleted = (data ?? []).map((r) => r.id)
  const blocked = ids.filter((id) => !deleted.includes(id))
  return NextResponse.json({ ok: true, deleted, blocked })
}
