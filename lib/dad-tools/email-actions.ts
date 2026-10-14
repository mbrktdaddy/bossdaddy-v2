'use server'

// Tool email opt-ins: yearly Weekends Until check-in + Sunday-night moments.
// Both support anonymous + authenticated users. Unsubscribe via per-row token
// (no login required) — see /tools/email/unsubscribe.

import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateAnonymousId } from './cookies'

const SubscribeSchema = z.object({
  // trim + lowercase here (not just in the UI) so the stored value always
  // matches the lower(email) unique index from migration 163.
  email: z.string().trim().email().toLowerCase(),
  kind: z.enum(['yearly_weekends_checkin', 'sunday_moments']),
  kid_profile_id: z.string().uuid().optional().nullable(),
  anchor_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type EmailActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// `already: true` = this address is already on this list (for this kid). It is
// a success, not an error — the UI shows a neutral line instead of the confirm.
export type SubscribeResult =
  | { ok: true; already: false; data: { id: string; unsubscribeToken: string } }
  | { ok: true; already: true }
  | { ok: false; error: string }

// Postgres unique_violation — the idx_tool_email_subs_unique index (mig 163).
const UNIQUE_VIOLATION = '23505'

export async function subscribeToToolEmail(
  input: z.input<typeof SubscribeSchema>,
): Promise<SubscribeResult> {
  const parsed = SubscribeSchema.safeParse(input)
  if (!parsed.success) {
    // Only the email is user-typed; the other fields are set by the page.
    return parsed.error.issues[0]?.path[0] === 'email'
      ? { ok: false, error: 'That email doesn’t look right.' }
      : { ok: false, error: 'Couldn’t save that. Try again in a minute.' }
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

  if (error) {
    // The unique index is the arbiter, so a double-submit or a race between
    // two tabs lands here too — no check-then-insert window to lose.
    if (error.code === UNIQUE_VIOLATION) return { ok: true, already: true }
    // Raw Postgres text never reaches the browser; log it server-side only.
    console.error('subscribeToToolEmail failed:', error.code, error.message)
    return { ok: false, error: 'Couldn’t save that. Try again in a minute.' }
  }

  return {
    ok: true,
    already: false,
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

  if (error) {
    console.error('unsubscribeToolEmail failed:', error.code, error.message)
    return { ok: false, error: 'Couldn’t remove that. Try again in a minute.' }
  }

  return { ok: true }
}
