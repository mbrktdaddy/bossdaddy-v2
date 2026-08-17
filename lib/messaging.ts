'use server'

// Member-to-member messaging mutations. Reads (conversation list, thread) are
// done directly in the server components/pages. All writes go through here.
//
// Safety: RLS gates inserts to active participants; this layer adds explicit
// block checks (both directions) on send, since a block may be created after a
// conversation already exists.

import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOtherParticipants, isBlockedBetween, isConnectedTo, pushNewMessage } from '@/lib/messaging-shared'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizePlainText } from '@/lib/sanitize'
import { isReactionKind, type ReactionKind } from '@/lib/messaging-reactions'
import { revalidatePath } from 'next/cache'

// `code` lets a caller distinguish "you two aren't connected yet" — a normal,
// actionable state that should render a Connect button — from a real failure.
// Optional so every existing call site keeps compiling and ignoring it.
type FailureCode = 'not_connected' | 'blocked'
type Result<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: FailureCode }

const MAX_BODY = 4000

/** Find or create the 1:1 conversation with another user (RPC handles dedupe + block check). */
export async function getOrCreateDm(otherUserId: string): Promise<Result<{ conversationId: string }>> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to send messages' }
  if (otherUserId === user.id) return { ok: false, error: 'You cannot message yourself' }

  const { data, error } = await supabase.rpc('get_or_create_dm', { _other_user: otherUserId })
  if (error || !data) {
    // The RPC raises distinguishable strings (migration 140 §7). 'not connected'
    // is a NORMAL state, not a failure — you just haven't connected yet — so it
    // gets its own copy and a caller-visible code the UI can branch on to show a
    // Connect button instead of an error.
    const message = error?.message ?? ''
    if (message.includes('not connected')) {
      return { ok: false, error: 'Connect with them first — then you can message.', code: 'not_connected' }
    }
    if (message.includes('blocked')) {
      return { ok: false, error: 'You cannot message this user.', code: 'blocked' }
    }
    return { ok: false, error: 'Could not start the conversation' }
  }
  return { ok: true, data: { conversationId: data as string } }
}

export async function sendMessage(
  conversationId: string,
  body: string,
  /** The message being replied to (migration 155). Must be in this conversation. */
  replyToId?: string | null,
): Promise<Result<{ id: string }>> {
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
  // Connections can be ended after a thread exists — same reasoning as the block
  // check above. Disconnecting has to actually stop the messages.
  if (!await isConnectedTo(admin, user.id, others)) {
    return { ok: false, error: 'You\'re not connected any more.', code: 'not_connected' }
  }

  // THE PARENT MUST LIVE IN THIS CONVERSATION. A CHECK constraint can't subquery,
  // so this is the only place it's enforced — and without it a crafted POST could
  // quote a message from a thread the reader isn't in, turning a reply preview into
  // a read primitive for someone else's DMs. Silently dropped rather than errored:
  // the message itself is fine and worth sending, only the quote is not.
  let parentId: string | null = null
  if (replyToId) {
    const { data: parent } = await admin
      .from('messages')
      .select('id')
      .eq('id', replyToId)
      .eq('conversation_id', conversationId)
      .maybeSingle()
    parentId = parent ? replyToId : null
  }

  // RLS additionally enforces: sender is a participant AND the account is active.
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, body: text, reply_to_id: parentId })
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

/**
 * Mute / unmute a thread for me only (migration 155).
 *
 * NOT BLOCK, and the difference is the whole reason it exists: block severs the
 * connection — which cascades away goal participation via migration 140's trigger
 * — so quieting a chatty-but-fine contact used to cost the relationship. This just
 * stops the pinging. The thread, its history, and sending all keep working.
 *
 * Self-directed, so the existing `conv_participants_self_update` policy covers it.
 */
export async function setConversationMuted(conversationId: string, muted: boolean): Promise<Result> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }
  const { error } = await supabase
    .from('conversation_participants')
    .update({ muted_at: muted ? new Date().toISOString() : null })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: 'Could not update notifications for this thread' }
  // The list row shows a muted glyph and the bell's count changes, so both
  // surfaces need re-rendering.
  revalidatePath('/account/messages')
  return { ok: true }
}

/**
 * React to a message, or take the reaction back.
 *
 * ONE PER PERSON PER MESSAGE (migration 155's primary key): the same kind again
 * removes it, a different kind replaces it. Returns the resulting kind (or null)
 * so the caller can reconcile rather than guess at the toggle.
 *
 * ⚠️ GATED ON BLOCK AND CONNECTION, exactly like sendMessage — because a reaction
 *    IS contact. RLS only proves you're a participant, and a conversation outlives
 *    the state that allowed it: without these two checks a blocked man could still
 *    put hearts on the messages of the person who blocked him, and they would
 *    appear live in her open thread. Quiet failure, loud consequence.
 */
export async function toggleReaction(
  messageId: string,
  kind: string,
): Promise<Result<{ kind: ReactionKind | null }>> {
  if (!isReactionKind(kind)) return { ok: false, error: 'Unknown reaction' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to react' }

  const admin = createAdminClient()

  const { data: msg } = await admin
    .from('messages')
    .select('conversation_id')
    .eq('id', messageId)
    .maybeSingle()
  if (!msg) return { ok: false, error: 'Message not found' }

  const others = await getOtherParticipants(admin, msg.conversation_id, user.id)
  if (others.length === 0) return { ok: false, error: 'Conversation not found' }
  if (await isBlockedBetween(admin, user.id, others)) {
    return { ok: false, error: 'Messaging is unavailable with this user.' }
  }
  if (!await isConnectedTo(admin, user.id, others)) {
    return { ok: false, error: 'You\'re not connected any more.', code: 'not_connected' }
  }

  const { data: existing } = await supabase
    .from('message_reactions')
    .select('kind')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.kind === kind) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
    if (error) return { ok: false, error: 'Could not remove that' }
    return { ok: true, data: { kind: null } }
  }

  const { error } = await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: user.id, kind }, { onConflict: 'message_id,user_id' })
  if (error) return { ok: false, error: 'Could not react' }
  return { ok: true, data: { kind } }
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
  /**
   * A note in a goal's notes feed (migration 145). Every other place two members
   * can address each other has a report route; the feed is not the exception, and
   * the owner's ability to DELETE something said there is not the same thing —
   * deletion is silent and leaves no record for a moderator.
   */
  goalNoteId?:     string | null
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
    goal_note_id:     input.goalNoteId ?? null,
    reason,
    note:             input.note ?? null,
  })
  if (error) return { ok: false, error: 'Could not submit report' }
  return { ok: true }
}
