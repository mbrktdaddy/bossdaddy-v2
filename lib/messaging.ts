'use server'

// Member-to-member messaging mutations. Reads (conversation list, thread) are
// done directly in the server components/pages. All writes go through here.
//
// Safety: RLS gates inserts to active participants; this layer adds explicit
// block checks (both directions) on send, since a block may be created after a
// conversation already exists.

import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string }

const MAX_BODY = 4000

/** Find or create the 1:1 conversation with another user (RPC handles dedupe + block check). */
export async function getOrCreateDm(otherUserId: string): Promise<Result<{ conversationId: string }>> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to send messages' }
  if (otherUserId === user.id) return { ok: false, error: 'You cannot message yourself' }

  const { data, error } = await supabase.rpc('get_or_create_dm', { _other_user: otherUserId })
  if (error || !data) {
    const blocked = (error?.message ?? '').includes('blocked')
    return { ok: false, error: blocked ? 'You cannot message this user.' : 'Could not start the conversation' }
  }
  return { ok: true, data: { conversationId: data as string } }
}

export async function sendMessage(conversationId: string, body: string): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to send messages' }

  const text = body.trim()
  if (!text) return { ok: false, error: 'Message is empty' }
  if (text.length > MAX_BODY) return { ok: false, error: `Message must be ${MAX_BODY} characters or fewer` }

  const admin = createAdminClient()

  // Other participants + block check (both directions).
  const { data: parts } = await admin
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversationId)
  const others = (parts ?? []).map((p) => p.user_id).filter((uid) => uid !== user.id)
  if (others.length === 0) return { ok: false, error: 'Conversation not found' }

  const [{ data: b1 }, { data: b2 }] = await Promise.all([
    admin.from('user_blocks').select('blocked_id').eq('blocker_id', user.id).in('blocked_id', others),
    admin.from('user_blocks').select('blocker_id').eq('blocked_id', user.id).in('blocker_id', others),
  ])
  if ((b1?.length ?? 0) + (b2?.length ?? 0) > 0) {
    return { ok: false, error: 'Messaging is unavailable with this user.' }
  }

  // RLS additionally enforces: sender is a participant AND the account is active.
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select('id')
    .single()
  if (error || !msg) return { ok: false, error: 'Could not send message' }

  // In-app notification to each peer (best-effort).
  const { data: me } = await admin.from('profiles').select('username, display_name').eq('id', user.id).single()
  const senderName = me?.display_name || me?.username || 'Someone'
  const preview = text.length > 80 ? `${text.slice(0, 80)}…` : text
  for (const uid of others) {
    await createNotification({
      userId: uid,
      type:   'new_message',
      title:  `New message from ${senderName}`,
      body:   preview,
      link:   `/account/messages/${conversationId}`,
      payload: { conversation_id: conversationId },
    })
  }

  revalidatePath(`/account/messages/${conversationId}`)
  return { ok: true, data: { id: msg.id } }
}

export async function markConversationRead(conversationId: string): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
  return { ok: true }
}

export async function blockUser(targetId: string): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  const { error } = await supabase.from('user_blocks').upsert({ blocker_id: user.id, blocked_id: targetId })
  if (error) return { ok: false, error: 'Could not block user' }
  return { ok: true }
}

export async function unblockUser(targetId: string): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  await supabase.from('user_blocks').delete().eq('blocker_id', user.id).eq('blocked_id', targetId)
  return { ok: true }
}

export async function reportContent(input: {
  reportedUserId?: string | null
  messageId?:      string | null
  conversationId?: string | null
  reason:          string
  note?:           string | null
}): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  const reason = input.reason.trim()
  if (!reason) return { ok: false, error: 'Pick a reason' }
  const { error } = await supabase.from('abuse_reports').insert({
    reporter_id:      user.id,
    reported_user_id: input.reportedUserId ?? null,
    message_id:       input.messageId ?? null,
    conversation_id:  input.conversationId ?? null,
    reason,
    note:             input.note ?? null,
  })
  if (error) return { ok: false, error: 'Could not submit report' }
  return { ok: true }
}
