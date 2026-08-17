import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import Thread from './_components/Thread'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conversation',
  robots: { index: false, follow: false },
}

/** How much history the thread opens with. Paging further back is not built yet. */
const WINDOW = 200

type PageProps = { params: Promise<{ conversationId: string }> }

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/account/messages/${conversationId}`)

  // Participant check (RLS returns only rows in conversations the user is in).
  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('user_id, last_read_at, deleted_at, muted_at')
    .eq('conversation_id', conversationId)
  const mine = parts?.find((p) => p.user_id === user.id)
  if (!parts || !mine) redirect('/account/messages')

  const peerPart = parts.find((p) => p.user_id !== user.id) ?? null
  const peerId = peerPart?.user_id ?? null
  // Peer's last_read_at drives the "Seen" indicator under my latest message.
  const peerLastReadAt = peerPart?.last_read_at ?? null
  let peer: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null = null
  if (peerId) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', peerId).single()
    if (data) peer = { id: data.id, username: data.username, displayName: data.display_name, avatarUrl: data.avatar_url }
  }

  // ⚠️ NEWEST FIRST, THEN REVERSED. This read was `ascending: true` with the same
  //    limit, which takes the OLDEST 200 — so past 200 messages a thread opened on
  //    its first-ever exchange and showed none of the recent ones. Realtime kept
  //    appending live arrivals, so it looked fine until a reload, and an active
  //    daily thread reaches 200 in a few weeks. Descending + reverse is the fix;
  //    the render order the component wants is still oldest-at-top.
  //
  // DELETE-FOR-ME IS APPLIED HERE TOO. Migration 084 hides a thread until newer
  // activity arrives, but the messages themselves were never filtered — so a man
  // who deleted a painful thread got the whole of it back the moment one new
  // message landed. That reads as a betrayal, not a feature. He keeps what arrived
  // AFTER he cleared it; nothing is destroyed for the other side.
  let query = supabase
    .from('messages')
    .select('id, sender_id, body, created_at, attachment_path, attachment_width, attachment_height, reply_to_id')
    .eq('conversation_id', conversationId)
  if (mine.deleted_at) query = query.gt('created_at', mine.deleted_at)

  const { data: recent } = await query
    .order('created_at', { ascending: false })
    .limit(WINDOW)
  const messages = (recent ?? []).slice().reverse()

  // Quoted parents for any replies in the window. Fetched by id rather than taken
  // from `messages`, because the message being replied to is very often older than
  // the window — that's the whole reason to quote it. RLS still scopes this to
  // conversations the reader belongs to.
  const parentIds = Array.from(new Set(
    messages.map((m) => m.reply_to_id).filter((id): id is string => !!id),
  ))
  let replyParents: { id: string; sender_id: string; body: string; attachment_path: string | null }[] = []
  if (parentIds.length) {
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, body, attachment_path')
      .in('id', parentIds)
    replyParents = data ?? []
  }

  // Reactions on the loaded window. One batched read; RLS gates it to messages in
  // conversations the reader is in (migration 155's is_message_participant).
  let reactions: { message_id: string; user_id: string; kind: string }[] = []
  if (messages.length) {
    const { data } = await supabase
      .from('message_reactions')
      .select('message_id, user_id, kind')
      .in('message_id', messages.map((m) => m.id))
    reactions = data ?? []
  }

  let blocked = false
  if (peerId) {
    const { data: b } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', peerId)
      .maybeSingle()
    blocked = !!b
  }

  return (
    <Thread
      conversationId={conversationId}
      meId={user.id}
      peer={peer}
      initialMessages={messages}
      initialReplyParents={replyParents}
      initialReactions={reactions}
      initiallyBlocked={blocked}
      initiallyMuted={!!mine.muted_at}
      initialPeerLastReadAt={peerLastReadAt}
    />
  )
}
