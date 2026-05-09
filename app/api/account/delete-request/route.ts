import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/account/delete-request
//
// User-initiated account deletion. Sets account_status=pending_deletion and
// deletion_requested_at=now. The cron job /api/cron/delete-expired-accounts
// hard-deletes anyone in this state for ≥30 days. The user can cancel any
// time within the window via /api/account/cancel-deletion.
//
// Authors with published reviews or guides are blocked here — content
// transfer is a manual admin task. For Boss Daddy this affects ~0% of
// users (only the site owner is an author).
export async function POST() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Block authors with content — they'd lose their reviews/guides on hard delete.
  const [{ count: reviewCount }, { count: guideCount }] = await Promise.all([
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('guides').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
  ])

  if ((reviewCount ?? 0) > 0 || (guideCount ?? 0) > 0) {
    return NextResponse.json({
      error: 'You have published content. Please contact Boss Daddy to delete your account.',
    }, { status: 422 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin
    .from('profiles')
    .update({
      account_status: 'pending_deletion',
      deletion_requested_at: now,
      moderation_action_at: now,
      moderation_action_by: user.id,
    })
    .eq('id', user.id)

  if (error) {
    console.error('delete-request profile update failed:', error)
    return NextResponse.json({ error: 'Could not request deletion.' }, { status: 500 })
  }

  // Audit row — self-initiated
  await admin.from('moderation_actions').insert({
    actor_id: user.id,
    target_id: user.id,
    action_type: 'request_deletion',
  })

  return NextResponse.json({ success: true })
}
