import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

// GET /api/cron/cleanup-carts
// Runs nightly. Deletes anonymous carts that haven't been touched in 30 days.
// User carts are kept — they persist across sessions by design.
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

  // Delete anon carts (no user_id) older than 30 days
  const { count: anonDeleted, error: anonErr } = await admin
    .from('carts')
    .delete({ count: 'exact' })
    .is('user_id', null)
    .lt('updated_at', cutoff)

  if (anonErr) {
    console.error('cron cleanup-carts: anon delete failed:', anonErr)
    return NextResponse.json({ error: anonErr.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: anonDeleted ?? 0 })
}
