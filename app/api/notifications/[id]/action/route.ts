// Accept / decline an actionable notification.
//
// For `savings_invite` notifications, "accept" calls the existing
// acceptInvite() server action with the token carried in the payload, then
// stamps action_state. Other actionable types just record accepted/declined.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { acceptInvite } from '@/lib/dad-tools/savings-actions'

type RouteCtx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: RouteCtx) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await request.json().catch(() => ({})) as { action?: string }
  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: notif } = await supabase
    .from('notifications')
    .select('id, type, payload, action_required, action_state')
    .eq('id', id)
    .maybeSingle()
  if (!notif) return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
  if (!notif.action_required) return NextResponse.json({ error: 'Not an actionable notification' }, { status: 400 })
  if (notif.action_state && notif.action_state !== 'pending') {
    return NextResponse.json({ error: 'Already handled' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const payload = (notif.payload ?? {}) as Record<string, unknown>

  if (action === 'accept' && notif.type === 'savings_invite') {
    const token = typeof payload.invitation_token === 'string' ? payload.invitation_token : null
    if (!token) return NextResponse.json({ error: 'Invite token missing' }, { status: 400 })
    const res = await acceptInvite({ token })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
    await supabase.from('notifications')
      .update({ action_state: 'accepted', read_at: now })
      .eq('id', id)
    return NextResponse.json({ ok: true, goalId: res.data?.goalId })
  }

  // Connection requests answer from the notification itself — the whole point of
  // an actionable notification is not making someone go and find the page.
  //
  // BOTH branches run through respondToConnection, including decline: it owns the
  // rule that an accept notifies and a decline does not (migration 140, rule 4),
  // and it is what stamps declined_at so the cooldown has something to measure.
  // Falling through to the generic handler below would record the decline on the
  // notification and leave the connection row pending forever.
  if (notif.type === 'connection_request') {
    const requesterId = typeof payload.requester_id === 'string' ? payload.requester_id : null
    if (!requesterId) return NextResponse.json({ error: 'Request is missing its sender' }, { status: 400 })

    const { data: me } = await supabase
      .from('profiles').select('username, display_name').eq('id', user.id).maybeSingle()
    const myName = me?.display_name?.trim() || (me?.username ? `@${me.username}` : 'A Boss Daddy member')

    const { respondToConnection } = await import('@/lib/connections')
    const res = await respondToConnection(supabase, {
      otherUserId: requesterId, accept: action === 'accept', myName,
    })
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

    await supabase.from('notifications')
      .update({ action_state: action === 'accept' ? 'accepted' : 'declined', read_at: now })
      .eq('id', id)
    return NextResponse.json({ ok: true })
  }

  await supabase.from('notifications')
    .update({ action_state: action === 'accept' ? 'accepted' : 'declined', read_at: now })
    .eq('id', id)
  return NextResponse.json({ ok: true })
}
