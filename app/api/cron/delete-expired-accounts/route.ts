import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAccountStatusEmailDirect } from '@/lib/account-emails'

export const maxDuration = 60

// GET /api/cron/delete-expired-accounts
//
// Runs daily via Vercel Cron. Hard-deletes any account that has been in
// pending_deletion for ≥30 days. Each deletion goes through the Supabase
// admin auth API which removes the auth.users row; the profile row +
// votes + subscriptions + comments cascade away via foreign keys.
//
// Authors with published content can't reach pending_deletion (the
// /api/account/delete-request endpoint blocks them). If admin somehow
// queues an author for deletion, the auth.users delete will fail because
// reviews.author_id has no CASCADE — operator gets a clear error in the
// log and can intervene manually.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — cron endpoint refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  const isVercelCron = authHeader === `Bearer ${secret}`
  const isManual     = qSecret === secret
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()

  const { data: expired, error: queryErr } = await admin
    .from('profiles')
    .select('id, username, deletion_requested_at')
    .eq('account_status', 'pending_deletion')
    .lt('deletion_requested_at', cutoff)

  if (queryErr) {
    console.error('cron: pending_deletion query failed:', queryErr)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  const targets = expired ?? []
  const results: { id: string; username: string; ok: boolean; error?: string }[] = []

  for (const target of targets) {
    // Audit FIRST so we have a record even if the auth.users delete fails partway.
    await admin.from('moderation_actions').insert({
      actor_id: null, // system action
      target_id: target.id,
      action_type: 'delete',
      reason: 'Hard delete after 30-day pending_deletion cooldown',
    })

    // Capture email BEFORE deleteUser — auth.users row is gone after, can't look up.
    const { data: authUser } = await admin.auth.admin.getUserById(target.id)
    const email = authUser.user?.email ?? null

    const { error: deleteErr } = await admin.auth.admin.deleteUser(target.id)
    if (deleteErr) {
      console.error(`cron: failed to delete user ${target.username} (${target.id}):`, deleteErr)
      results.push({ id: target.id, username: target.username, ok: false, error: deleteErr.message })
      continue
    }

    results.push({ id: target.id, username: target.username, ok: true })

    // Final "your account is gone" email — last touch, GDPR-friendly. Awaited
    // because fire-and-forget gets dropped on serverless shutdown; if it fails
    // we still log and continue (the user is already hard-deleted, can't roll back).
    if (email) {
      try {
        await sendAccountStatusEmailDirect({
          to: email,
          username: target.username,
          event: 'hard_deleted',
        })
      } catch (err) {
        console.error('cron: hard_deleted email failed for', target.username, err)
      }
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed    = results.length - succeeded

  return NextResponse.json({
    examined: targets.length,
    succeeded,
    failed,
    results,
  })
}
