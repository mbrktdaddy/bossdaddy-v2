'use server'

// Tool email opt-ins: yearly Weekends Until check-in + Sunday-night moments.
// Both support anonymous + authenticated users. Unsubscribe via per-row token
// (no login required) — see /tools/email/unsubscribe.

import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateAnonymousId } from './cookies'

const SubscribeSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  kind: z.enum(['yearly_weekends_checkin', 'sunday_moments']),
  kid_profile_id: z.string().uuid().optional().nullable(),
  anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type EmailActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export async function subscribeToToolEmail(
  input: z.input<typeof SubscribeSchema>,
): Promise<EmailActionResult<{ id: string; unsubscribeToken: string }>> {
  const parsed = SubscribeSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const anonId = user ? null : await getOrCreateAnonymousId()
  const admin = createAdminClient()

  const anchor =
    parsed.data.kind === 'yearly_weekends_checkin'
      ? (parsed.data.anchor_date ?? new Date().toISOString().slice(0, 10))
      : null

  const { data, error } = await admin.from('tool_email_subscriptions')
    .insert({
      email: parsed.data.email,
      kind: parsed.data.kind,
      kid_profile_id: parsed.data.kid_profile_id ?? null,
      user_id: user?.id ?? null,
      anonymous_id: anonId,
      anchor_date: anchor,
    })
    .select('id, unsubscribe_token')
    .single()

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: {
      id: data.id as string,
      unsubscribeToken: data.unsubscribe_token as string,
    },
  }
}

export async function unsubscribeToolEmail(token: string): Promise<EmailActionResult> {
  const parsed = z.string().uuid().safeParse(token)
  if (!parsed.success) return { ok: false, error: 'Invalid token' }

  const admin = createAdminClient()
  const { error } = await admin.from('tool_email_subscriptions')
    .delete()
    .eq('unsubscribe_token', parsed.data)

  if (error) return { ok: false, error: error.message }

  return { ok: true }
}
