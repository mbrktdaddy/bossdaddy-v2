import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { z } from 'zod'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

// POST /api/admin/users/moderate — admin only, suspend / ban / restore a user
//
// Action map:
//   suspend   → account_status='suspended', suspended_until=<duration from now>
//   unsuspend → account_status='active',    suspended_until=null
//   ban       → account_status='banned'  (permanent, content hidden site-wide)
//   unban     → account_status='active'
//   delete    → account_status='pending_deletion', deletion_requested_at=now
//               (admin-initiated; cron sweeps pending_deletion >30d to hard delete)
//   restore   → account_status='active'  (reverses any non-active status)
//
// Every action writes a moderation_actions audit row.

const Schema = z.object({
  userId: z.string().uuid(),
  action: z.enum(['suspend', 'unsuspend', 'ban', 'unban', 'delete', 'restore']),
  durationDays: z.number().int().min(1).max(3650).optional(),
  reason: z.string().max(500).optional(),
  note: z.string().max(2000).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { userId, action, durationDays, reason, note } = parsed.data

  if (userId === user.id) {
    return NextResponse.json({ error: 'You cannot moderate your own account.' }, { status: 400 })
  }

  if (action === 'suspend' && !durationDays) {
    return NextResponse.json({ error: 'Suspend requires durationDays.' }, { status: 400 })
  }

  // Compose the profile update for this action
  const now = new Date().toISOString()
  const updates: ProfileUpdate = {
    moderation_action_at: now,
    moderation_action_by: user.id,
  }
  if (reason !== undefined) updates.moderation_reason = reason ?? null
  if (note !== undefined)   updates.moderation_note   = note ?? null

  switch (action) {
    case 'suspend':
      updates.account_status = 'suspended'
      updates.suspended_until = new Date(Date.now() + durationDays! * 86_400_000).toISOString()
      break
    case 'unsuspend':
    case 'unban':
    case 'restore':
      updates.account_status = 'active'
      updates.suspended_until = null
      updates.deletion_requested_at = null
      break
    case 'ban':
      updates.account_status = 'banned'
      updates.suspended_until = null
      break
    case 'delete':
      updates.account_status = 'pending_deletion'
      updates.deletion_requested_at = now
      updates.suspended_until = null
      break
  }

  const admin = createAdminClient()
  const { error: updateErr } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', userId)

  if (updateErr) {
    console.error('moderation profile update failed:', updateErr)
    return NextResponse.json({ error: `Update failed: ${updateErr.message}` }, { status: 500 })
  }

  // Audit row — fire and let it succeed or fail; the profile is what governs access.
  const { error: auditErr } = await admin.from('moderation_actions').insert({
    actor_id:    user.id,
    target_id:   userId,
    action_type: action,
    reason:      reason ?? null,
    payload:     durationDays ? { durationDays } : null,
  })
  if (auditErr) console.error('moderation audit insert failed:', auditErr)

  return NextResponse.json({ success: true })
}
