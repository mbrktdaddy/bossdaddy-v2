// Server-only chokepoint for creating in-app notifications.
//
// Every event producer (Stripe webhook, review moderation, account moderation,
// savings invites, new DMs) funnels through createNotification(). Inserts use
// the service-role admin client because `notifications` has no public INSERT
// policy by design (see migration 082). Per product decision, this does NOT
// send email — events that already email keep their existing email; the
// in-app notification is added alongside.

import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'

export type NotificationType =
  | 'savings_invite'
  // An accountability-partner invite on a goal. `link` points at the token page,
  // so accepting happens there rather than through the notification action route —
  // no `action_required`, nothing new to teach /api/notifications/[id]/action.
  | 'goal_invite'
  // Someone posted in a goal's notes feed (migration 145).
  //
  // ⚠️ THE ONE PARTNER-FACING NOTIFICATION, AND NOT A HOLE IN MIGRATION 137.
  //    137 forbids telling a partner ANYTHING THE SYSTEM OBSERVED — "he missed his
  //    meds" is surveillance and the sweep stays owner-only. This is a person
  //    speaking to another person, which is a message, and suppressing it would
  //    just mean nobody ever comes back to the feed. Carries WHO and WHERE only:
  //    the note body never leaves the auth wall, and a sensitive goal is never
  //    named. See lib/goals/note-notify.ts for the full reasoning.
  | 'goal_note'
  // A member asking to connect. Actionable — accept/decline live on the
  // notification itself. DECLINING SENDS NOTHING BACK (migration 140, rule 4),
  // which is why there is no 'connection_declined' here and must never be one.
  | 'connection_request'
  | 'connection_accepted'
  | 'order_complete'
  | 'review_approved'
  | 'review_rejected'
  | 'review_request_edits'
  | 'account_action'
  | 'goal_completed'
  // A due reminder on a goal. NOT produced through createNotification(): the
  // sweep inserts a whole tick's worth in one statement (lib/goals/sweep.ts), so
  // this member is here to keep the catalogue of live `type` values honest rather
  // than because anything calls in with it.
  //
  // Its `link` points at /goals/<id>?occ=<occurrence> — the DETAIL page, not the
  // /g/<token> one-tap page that the matching push and email use. In-app is
  // already past the auth wall; see the reasoning at that insert.
  | 'goal_reminder'

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

interface CreateNotificationArgs {
  userId:          string
  type:            NotificationType
  title:           string
  body?:           string | null
  link?:           string | null
  payload?:        Record<string, unknown>
  actionRequired?: boolean
}

/**
 * Insert a notification for one recipient. Never throws — logs and returns a
 * result so producers can fire-and-forget without risking their main flow
 * (e.g. a webhook must still 200 even if the notification insert hiccups).
 */
export async function createNotification(
  args: CreateNotificationArgs,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const admin = createAdminClient()
    const row: NotificationInsert = {
      user_id:         args.userId,
      type:            args.type,
      title:           args.title,
      body:            args.body ?? null,
      link:            args.link ?? null,
      payload:         (args.payload ?? {}) as NotificationInsert['payload'],
      action_required: args.actionRequired ?? false,
      action_state:    args.actionRequired ? 'pending' : null,
    }
    const { data, error } = await admin
      .from('notifications')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) {
      console.error('createNotification failed:', error?.message)
      return { ok: false, error: error?.message ?? 'insert failed' }
    }
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('createNotification threw:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' }
  }
}
