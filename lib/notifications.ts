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
  | 'order_complete'
  | 'review_approved'
  | 'review_rejected'
  | 'review_request_edits'
  | 'account_action'
  | 'new_message'
  | 'goal_completed'

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
