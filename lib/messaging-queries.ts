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
}

export async function listConversationsFor(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ConversationSummary[]> {
  const { data: myParts } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)
  const ids = (myParts ?? []).map((p) => p.conversation_id)
  if (ids.length === 0) return []

  const lastReadByConv = new Map((myParts ?? []).map((p) => [p.conversation_id, p.last_read_at]))

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
    .select('conversation_id, sender_id, body, created_at')
    .in('conversation_id', ids)
    .order('created_at', { ascending: false })
    .limit(300)
  const latestByConv = new Map<string, { body: string; created_at: string; sender_id: string }>()
  for (const m of msgs ?? []) {
    if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m)
  }

  const summaries: ConversationSummary[] = ids.map((id) => {
    const peerId = peerIdByConv.get(id) ?? null
    const prof = peerId ? profById.get(peerId) : null
    const last = latestByConv.get(id) ?? null
    const lastRead = lastReadByConv.get(id)
    const fromMe = last ? last.sender_id === userId : false
    const unread = !!last && !fromMe && (!lastRead || new Date(last.created_at) > new Date(lastRead))
    return {
      id,
      peer: prof
        ? { id: prof.id, username: prof.username, displayName: prof.display_name, avatarUrl: prof.avatar_url }
        : peerId ? { id: peerId, username: 'member', displayName: null, avatarUrl: null } : null,
      lastMessage: last ? { body: last.body, createdAt: last.created_at, fromMe } : null,
      unread,
    }
  })

  summaries.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0
    return tb - ta
  })
  return summaries
}
