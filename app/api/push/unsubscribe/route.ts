// Remove a device's push subscription. RLS scopes the delete to the caller's
// own rows; deleting by endpoint is enough (endpoints are opaque + unique).

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', body.endpoint)
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
