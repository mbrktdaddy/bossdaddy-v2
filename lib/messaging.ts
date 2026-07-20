'use server'

// Member-to-member messaging mutations. Reads (conversation list, thread) are
// done directly in the server components/pages. All writes go through here.
//
// Safety: RLS gates inserts to active participants; this layer adds explicit
// block checks (both directions) on send, since a block may be created after a
// conversation already exists.

import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOtherParticipants, isBlockedBetween, pushNewMessage } from '@/lib/messaging-shared'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizePlainText } from '@/lib/sanitize'
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

  // Flood backstop (A5): 30 sends/min per user. RLS + block checks below are the
  // real gate; this throttles spam/harassment scripts.
  const { success } = await checkRateLimit(`message:${user.id}`, 'message')
  if (!success) return { ok: false, error: "You're sending messages too fast — take a breath." }

  // Strip any HTML markup before persisting (A4, defense-in-depth). The body is
  // rendered as escaped text today, but sanitizing on write keeps stored markup
  // out if the render path ever changes. Trim after — sanitizing can leave edge
  // whitespace.
  const text = sanitizePlainText(body).trim()
  if (!text) return { ok: false, error: 'Message is empty' }
  if (text.length > MAX_BODY) return { ok: false, error: `Message must be ${MAX_BODY} characters or fewer` }

  const admin = createAdminClient()

  // Other participants + block check (both directions).
  const others = await getOtherParticipants(admin, conversationId, user.id)
  if (others.length === 0) return { ok: false, error: 'Conversation not found' }
  if (await isBlockedBetween(admin, user.id, others)) {
    return { ok: false, error: 'Messaging is unavailable with this user.' }
  }

  // RLS additionally enforces: sender is a participant AND the account is active.
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text })
    .select('id')
    .single()
  if (error || !msg) return { ok: false, error: 'Could not send message' }

  await pushNewMessage(admin, others, user.id, conversationId)

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

/**
 * Delete-for-me: hide a conversation from the caller's list without touching
 * the other participant's copy. Reappears for the caller if a newer message
 * arrives (see listConversationsFor). Owner-update is allowed by the
 * conv_participants_self_update RLS policy.
 */
export async function deleteConversation(conversationId: string): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  const { error } = await supabase
    .from('conversation_participants')
    .update({ deleted_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/account/messages')
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
