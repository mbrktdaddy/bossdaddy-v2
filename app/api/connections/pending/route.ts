import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// How many people are waiting on an answer. Drives the badge on the "Your Corner"
// nav item.
//
// A count, never the rows. The badge needs a number and nothing else, and an
// endpoint that returns who is asking would be a second, chattier copy of
// /account/connections with no access control of its own to get wrong.
//
// `head: true` so Postgres returns the count without materialising rows. RLS
// scopes it to this user's own relationships, so there is no ownership check to
// forget here.

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ count: 0 })

  const { count, error } = await supabase
    .from('user_connections')
    .select('user_a', { count: 'exact', head: true })
    .eq('status', 'pending')
    .neq('requester_id', user.id)
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

  // A failed count renders NOTHING rather than a zero — same rule the votes line
  // follows. A badge that says 0 is worse than no badge.
  if (error) {
    console.error('connections: pending count failed —', error.message)
    return NextResponse.json({ count: 0 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
