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
 * True if `meId` is still connected to everyone in `others`.
 *
 * The sibling of isBlockedBetween, and here for the same reason it is: a
 * conversation outlives the state that allowed it. get_or_create_dm gates
 * CREATION on an accepted connection (migration 140 §7), but a connection can be
 * removed — or blocked away — long after the thread exists, and without this the
 * thread would keep working forever. Disconnecting has to actually stop the
 * messages, or it isn't disconnecting.
 *
 * Grandfathered threads are fine: migration 140 back-filled an accepted
 * connection for every conversation that already existed.
 */
export async function isConnectedTo(
  admin: Admin,
  meId: string,
  others: string[],
): Promise<boolean> {
  if (others.length === 0) return true
  const { data } = await admin
    .from('user_connections')
    .select('user_a, user_b')
    .eq('status', 'accepted')
    .or(`user_a.eq.${meId},user_b.eq.${meId}`)

  const connected = new Set(
    (data ?? []).map((r) => (r.user_a === meId ? r.user_b : r.user_a)),
  )
  return others.every((id) => connected.has(id))
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
  // MUTE IS ENFORCED HERE, NOT JUST IN THE BADGE (migration 155). A mute that
  // still buzzes the phone is not a mute — and push is the loudest of the three
  // surfaces, so this is the one that would be noticed first if it were missed.
  // Read with the admin client because we're resolving OTHER people's rows.
  const { data: mutedRows } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .in('user_id', others)
    .not('muted_at', 'is', null)
  const muted = new Set((mutedRows ?? []).map((r) => r.user_id))
  const recipients = others.filter((uid) => !muted.has(uid))
  if (recipients.length === 0) return

  const { data: me } = await admin
    .from('profiles')
    .select('username, display_name')
    .eq('id', senderId)
    .single()
  const senderName = me?.display_name?.trim() || me?.username || 'Someone'
  await Promise.all(
    recipients.map((uid) =>
      sendPushToUser(uid, {
        title: `New message from ${senderName}`,
        url: `/account/messages/${conversationId}`,
        tag: `dm:${conversationId}`,
      }),
    ),
  )
}
