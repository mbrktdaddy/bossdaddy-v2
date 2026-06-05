// Shared server-side helpers for sending into a DM conversation. Used by both
// the text-send server action (lib/messaging.ts) and the image-upload route
// (/api/dm/upload) so the participant resolution, block enforcement, and
// out-of-network push behave identically regardless of message kind.
//
// All functions take a service-role admin client. RLS still gates the actual
// message INSERT (sender must be a participant AND active); these helpers add
// the block check (which needs the peer id) and the notification fan-out.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { sendPushToUser } from '@/lib/push'

type Admin = SupabaseClient<Database>

/** Other participants in the conversation (everyone but `meId`). */
export async function getOtherParticipants(
  admin: Admin,
  conversationId: string,
  meId: string,
): Promise<string[]> {
  const { data: parts } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
  return (parts ?? []).map((p) => p.user_id).filter((uid) => uid !== meId)
}

/** True if either side has blocked the other (block may post-date the convo). */
export async function isBlockedBetween(
  admin: Admin,
  meId: string,
  others: string[],
): Promise<boolean> {
  if (others.length === 0) return false
  const [{ data: b1 }, { data: b2 }] = await Promise.all([
    admin.from('user_blocks').select('blocked_id').eq('blocker_id', meId).in('blocked_id', others),
    admin.from('user_blocks').select('blocker_id').eq('blocked_id', meId).in('blocker_id', others),
  ])
  return (b1?.length ?? 0) + (b2?.length ?? 0) > 0
}

/**
 * Out-of-network awareness. No in-app notification row per message — DMs live
 * in the Messages surface. Web push is the immediacy layer; the debounced
 * digest email (cron) is the slow fallback. Both are privacy-first: sender name
 * only, never message content. Best-effort — sendPushToUser never throws.
 */
export async function pushNewMessage(
  admin: Admin,
  others: string[],
  senderId: string,
  conversationId: string,
): Promise<void> {
  const { data: me } = await admin
    .from('profiles')
    .select('username, display_name')
    .eq('id', senderId)
    .single()
  const senderName = me?.display_name?.trim() || me?.username || 'Someone'
  await Promise.all(
    others.map((uid) =>
      sendPushToUser(uid, {
        title: `New message from ${senderName}`,
        url: `/account/messages/${conversationId}`,
        tag: `dm:${conversationId}`,
      }),
    ),
  )
}
