// Mark all of the current user's unread notifications read.

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)            // RLS already scopes to this user's rows
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
