// Member lookup for starting a DM. Returns active members matching the query
// by username or display name (excludes the caller). Profiles are public.

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Forgiving of a leading @ — usernames render as @name across the UI, so
  // people instinctively type it; strip it before matching.
  const q = (new URL(request.url).searchParams.get('q')?.trim() ?? '').replace(/^@+/, '')
  if (q.length < 2) return NextResponse.json({ members: [] })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, account_status')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .neq('id', user.id)
    .limit(10)
  if (error) return NextResponse.json({ members: [] })

  const members = (data ?? [])
    .filter((m) => (m.account_status ?? 'active') === 'active')
    .map((m) => ({ id: m.id, username: m.username, displayName: m.display_name, avatarUrl: m.avatar_url }))
  return NextResponse.json({ members })
}
