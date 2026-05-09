import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Banned and active-suspension accounts get signed out and bounced to
// /account/blocked. pending_deletion is *not* blocked here — those users
// must keep signing in to cancel the deletion within the 30-day cooldown.
// The cron at /api/cron/delete-expired-accounts hard-deletes them after
// the cooldown elapses; once that runs, their auth session is gone and
// they can't sign in at all.
export async function checkModerationGate(args: {
  request: NextRequest
  pathname: string
  supabase: SupabaseClient
  user: User | null
}): Promise<NextResponse | null> {
  const { request, pathname, supabase, user } = args
  if (!user) return null
  if (pathname.startsWith('/account/blocked')) return null
  if (pathname.startsWith('/api/auth/signout')) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status, suspended_until')
    .eq('id', user.id)
    .single()

  if (!profile) return null
  if (profile.account_status === 'active' || profile.account_status === 'pending_deletion') return null

  const stillSuspended = profile.account_status === 'suspended'
    && (!profile.suspended_until || new Date(profile.suspended_until) > new Date())
  const blocked = profile.account_status === 'banned' || stillSuspended

  if (blocked) {
    await supabase.auth.signOut()
    const url = request.nextUrl.clone()
    url.pathname = '/account/blocked'
    url.search = ''
    return NextResponse.redirect(url, { status: 303 })
  }

  // Suspension elapsed — restore active status, fall through to normal flow.
  if (profile.account_status === 'suspended' && !stillSuspended) {
    await supabase
      .from('profiles')
      .update({ account_status: 'active', suspended_until: null })
      .eq('id', user.id)
  }

  return null
}
