// Server-side read helpers for messaging. Used by both the conversations API
// route (header menu) and the /account/messages page. Pass an RLS-bound server
// client — RLS scopes every query to conversations the user belongs to.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export interface ConversationSummary {
  id:          string
  peer:        { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null
  unread:      boolean
  /**
   * How many incoming messages are unread in this thread, not just whether any
   * are. One unread conversation carrying fourteen messages and one carrying a
   * single "ok" used to render identically, which is the difference between
   * triaging an inbox and guessing at it. 0 whenever `unread` is false.
   */
  unreadCount: number
  /** Self-directed mute (155). The row still shows its count; the BADGE ignores it. */
  muted:       boolean
}

export async function listConversationsFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ConversationSummary[]> {
  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at, deleted_at, muted_at')
    .eq('user_id', userId)
  const ids = (myParts ?? []).map((p) => p.conversation_id)
  if (ids.length === 0) return []

  const lastReadByConv = new Map((myParts ?? []).map((p) => [p.conversation_id, p.last_read_at]))
  const deletedByConv = new Map((myParts ?? []).map((p) => [p.conversation_id, p.deleted_at]))
  const mutedByConv = new Map((myParts ?? []).map((p) => [p.conversation_id, p.muted_at]))

  const { data: peerParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', ids)
    .neq('user_id', userId)
  const peerIdByConv = new Map((peerParts ?? []).map((p) => [p.conversation_id, p.user_id]))
  const peerIds = Array.from(new Set((peerParts ?? []).map((p) => p.user_id)))

  let profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null }[] = []
  if (peerIds.length) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', peerIds)
    profiles = data ?? []
  }
  const profById = new Map(profiles.map((p) => [p.id, p]))

  // Latest message per conversation (cap the scan; DMs are low-volume).
  const { data: msgs } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, body, created_at, attachment_path')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })
    .limit(300)
  const latestByConv = new Map<string, { body: string; created_at: string; sender_id: string }>()
  for (const m of msgs ?? []) {
    if (latestByConv.has(m.conversation_id)) continue
    // Image-only message → show a "Photo" stand-in in the list preview.
    const body = m.body.trim() || (m.attachment_path ? 'Photo' : m.body)
    latestByConv.set(m.conversation_id, { body, created_at: m.created_at, sender_id: m.sender_id })
  }

  // ── Unread counts ──────────────────────────────────────────────────────────
  // A COUNT PER UNREAD THREAD RATHER THAN COUNTING THE SCAN ABOVE. That scan is
  // capped at 300 rows across every conversation, so counting within it would
  // quietly undercount exactly the busiest thread — the one where the number
  // matters most, and a wrong small number is worse than no number. `head: true`
  // sends no rows back, and this only runs for threads already known to be
  // unread, which is a handful even for a heavy user.
  const unreadIds = ids.filter((id) => {
    const last = latestByConv.get(id)
    if (!last || last.sender_id === userId) return false
    const lastRead = lastReadByConv.get(id)
    return !lastRead || new Date(last.created_at) > new Date(lastRead)
  })

  const countEntries = await Promise.all(unreadIds.map(async (id) => {
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', id)
      .neq('sender_id', userId)
      .gt('created_at', lastReadByConv.get(id)!)
    // Fall back to 1 rather than 0 on a failed count: we already know from the
    // scan that this thread IS unread, and a 0 would erase the dot entirely.
    return [id, count ?? 1] as const
  }))
  const unreadCountByConv = new Map<string, number>(countEntries)

  const summaries: ConversationSummary[] = ids.map((id) => {
    const peerId = peerIdByConv.get(id) ?? null
    const prof = peerId ? profById.get(peerId) : null
    const last = latestByConv.get(id) ?? null
    const fromMe = last ? last.sender_id === userId : false
    const unreadCount = unreadCountByConv.get(id) ?? 0
    return {
      id,
      peer: prof
        ? { id: prof.id, username: prof.username, displayName: prof.display_name, avatarUrl: prof.avatar_url }
        : peerId ? { id: peerId, username: 'member', displayName: null, avatarUrl: null } : null,
      lastMessage: last ? { body: last.body, createdAt: last.created_at, fromMe } : null,
      unread: unreadCount > 0,
      unreadCount,
      muted: !!mutedByConv.get(id),
    }
  })

  // Hide conversations the user deleted — unless a newer message has arrived
  // since (delete-for-me; the thread reappears on fresh activity).
  const visible = summaries.filter((s) => {
    const del = deletedByConv.get(s.id)
    if (!del) return true
    return !!s.lastMessage && new Date(s.lastMessage.createdAt) > new Date(del)
  })

  visible.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
    return tb - ta
  })
  return visible
}

/**
 * The number the header bell shows for messages.
 *
 * CONVERSATIONS, NOT MESSAGES, and deliberately different from the per-row count.
 * The bell's total is `notifications + messages`, and one notification is one
 * item — so one conversation has to be one item too, or the two halves of the
 * same badge would be counting different units and the sum would mean nothing.
 * Depth belongs in the list rows, where there's room to say "3".
 *
 * MUTED THREADS ARE EXCLUDED, which is the entire point of mute: the thread stays
 * readable and its row still shows a count, but it stops asking for attention.
 */
export function badgeUnreadCount(conversations: ConversationSummary[]): number {
  return conversations.filter((c) => c.unread && !c.muted).length
}
