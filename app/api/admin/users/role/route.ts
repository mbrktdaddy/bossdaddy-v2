import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAccountStatusEmail } from '@/lib/account-emails'
import type { AccountStatusEvent } from '@/emails/AccountStatusEmail'
import { z } from 'zod'

const Schema = z.object({
  userId: z.string().uuid(),
  role:   z.enum(['admin', 'author', 'member']),
  // Optional reason — flows into the email body. UI doesn't surface it yet
  // (the dropdown is one-click), but the endpoint accepts it so a future
  // confirm-with-reason dialog can ship without an API change.
  reason: z.string().max(500).optional(),
})

// PUT /api/admin/users/role — admin only, change a user's role
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  // Prevent admin from changing their own role
  if (parsed.data.userId === user.id) {
    return NextResponse.json({ error: 'You cannot change your own role.' }, { status: 400 })
  }

  // Read the OLD role before updating so we can detect the transition
  // afterwards. Admin client because we need to read across users; the
  // operator already passed the admin gate above.
  const admin = createAdminClient()
  const { data: target } = await admin
    .from('profiles')
    .select('role')
    .eq('id', parsed.data.userId)
    .single()
  const oldRole = target?.role ?? null

  // Use the user-scoped client so auth.uid() == admin. This satisfies both the
  // profiles_admin_write RLS policy and the prevent_role_escalation trigger,
  // which calls is_admin() and requires a non-NULL auth.uid(). The service_role
  // admin client would bypass RLS but leave auth.uid() NULL, causing the
  // trigger to raise "Only admins can change user roles".
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId)

  if (error) return NextResponse.json({ error: 'Role update failed' }, { status: 500 })

  // Notify the user when their workspace access changes — member↔author only.
  // Promotions to / demotions from admin are operator-only edge cases that
  // happen out of band (per the 3-tier role doctrine, only one admin exists),
  // so we skip emailing those to avoid noise on flows that involve the
  // operator themselves.
  const newRole = parsed.data.role
  let emailEvent: AccountStatusEvent | null = null
  if (oldRole === 'member' && newRole === 'author') emailEvent = 'promoted_to_author'
  else if (oldRole === 'author' && newRole === 'member') emailEvent = 'demoted_to_member'

  if (emailEvent) {
    // Awaited so the Resend send completes before the function returns —
    // fire-and-forget gets killed by serverless shutdown and the email is
    // lost. Matches the moderate endpoint pattern.
    try {
      await sendAccountStatusEmail({
        userId: parsed.data.userId,
        event:  emailEvent,
        reason: parsed.data.reason ?? null,
      })
    } catch (err) {
      console.error('role-change email send failed:', err)
    }
  }

  return NextResponse.json({ success: true })
}
