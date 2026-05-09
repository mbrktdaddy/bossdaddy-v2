import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/account/cancel-deletion
//
// User cancels their own pending deletion. Only works while account_status
// is still 'pending_deletion' — once the cron has hard-deleted, the auth
// session is gone and this endpoint is unreachable.
export async function POST() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('account_status')
    .eq('id', user.id)
    .single()

  if (profile?.account_status !== 'pending_deletion') {
    return NextResponse.json({ error: 'Account is not pending deletion.' }, { status: 422 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin
    .from('profiles')
    .update({
      account_status: 'active',
      deletion_requested_at: null,
      moderation_action_at: now,
      moderation_action_by: user.id,
    })
    .eq('id', user.id)

  if (error) {
    console.error('cancel-deletion update failed:', error)
    return NextResponse.json({ error: 'Could not cancel deletion.' }, { status: 500 })
  }

  await admin.from('moderation_actions').insert({
    actor_id: user.id,
    target_id: user.id,
    action_type: 'cancel_deletion',
  })

  return NextResponse.json({ success: true })
}
