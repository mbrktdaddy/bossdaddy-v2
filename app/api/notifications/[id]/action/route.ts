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

  await supabase.from('notifications')
    .update({ action_state: action === 'accept' ? 'accepted' : 'declined', read_at: now })
    .eq('id', id)
  return NextResponse.json({ ok: true })
}
