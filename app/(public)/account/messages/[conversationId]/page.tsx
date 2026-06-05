import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import Thread from './_components/Thread'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conversation',
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ conversationId: string }> }

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/account/messages/${conversationId}`)

  // Participant check (RLS returns only rows in conversations the user is in).
  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('user_id, last_read_at')
    .eq('conversation_id', conversationId)
  if (!parts || !parts.some((p) => p.user_id === user.id)) redirect('/account/messages')

  const peerPart = parts.find((p) => p.user_id !== user.id) ?? null
  const peerId = peerPart?.user_id ?? null
  // Peer's last_read_at drives the "Seen" indicator under my latest message.
  const peerLastReadAt = peerPart?.last_read_at ?? null
  let peer: { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null = null
  if (peerId) {
    const { data } = await supabase.from('profiles').select('id, username, display_name, avatar_url').eq('id', peerId).single()
    if (data) peer = { id: data.id, username: data.username, displayName: data.display_name, avatarUrl: data.avatar_url }
  }

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200)

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
      initialMessages={messages ?? []}
      initiallyBlocked={blocked}
      initialPeerLastReadAt={peerLastReadAt}
    />
  )
}
