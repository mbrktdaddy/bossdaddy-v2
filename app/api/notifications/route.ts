// List the current user's notifications (newest first) for the bell dropdown
// and the /account/notifications feed. RLS scopes rows to auth.uid().

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, payload, action_required, action_state, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const notifications = data ?? []
  const unread = notifications.filter((n) => !n.read_at).length
  return NextResponse.json({ notifications, unread })
}
