import { NextResponse, type NextRequest } from 'next/server'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { NewMessageEmail } from '@/emails/NewMessageEmail'

export const maxDuration = 60

// Debounced "you have unread messages" digest — the SLOW FALLBACK for DMs.
// Web push (lib/push.ts) now carries immediacy, so this window is long: a
// message must sit unread for WINDOW_MIN before it emails, so a push-notified
// user who reads within the window gets no email at all, and bursts coalesce
// into one digest. Email still reaches everyone without a live push
// subscription. Paired with a 5-min cron (vercel.json).
const WINDOW_MIN = 20
const MAX_AGE_HOURS = 24 // ignore stale backlog — and avoid a blast on first deploy

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — message-emails refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  if (authHeader !== `Bearer ${secret}` && qSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const now = Date.now()
  const windowAgoMs = now - WINDOW_MIN * 60_000
  const maxAgeIso = new Date(now - MAX_AGE_HOURS * 3_600_000).toISOString()
  const nowIso = new Date(now).toISOString()

  // 1. Recent messages (last MAX_AGE_HOURS), grouped in JS.
  const { data: msgRows } = await admin
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .gt('created_at', maxAgeIso)
    .order('created_at', { ascending: true })
  const msgs = msgRows ?? []
  if (msgs.length === 0) return NextResponse.json({ success: true, eligible: 0, sent: 0 })

  const convIds = Array.from(new Set(msgs.map((m) => m.conversation_id)))

  // 2. Participants of those conversations.
  const { data: partRows } = await admin
    .from('conversation_participants')
    .select('conversation_id, user_id, last_read_at, last_notified_at, deleted_at')
    .in('conversation_id', convIds)
  const parts = partRows ?? []

  // 3. Per participant: a latest incoming message, older than the window, that's
  //    unread and not already emailed (and not in a thread they soft-deleted).
  //    Timestamps compared numerically — Postgres "+00:00" vs JS "Z" make string
  //    comparison unsafe.
  type Eligible = { conversationId: string; peerId: string }
  const byRecipient = new Map<string, Eligible[]>()

  for (const p of parts) {
    const incoming = msgs.filter((m) => m.conversation_id === p.conversation_id && m.sender_id !== p.user_id)
    if (incoming.length === 0) continue
    const latest = incoming[incoming.length - 1] // asc order → last is newest
    const latestMs = new Date(latest.created_at).getTime()

    if (latestMs > windowAgoMs) continue // still inside the debounce window
    if (new Date(p.last_read_at).getTime() >= latestMs) continue // already read in-app
    if (p.last_notified_at && new Date(p.last_notified_at).getTime() >= latestMs) continue // already emailed
    if (p.deleted_at && new Date(p.deleted_at).getTime() >= latestMs) continue // soft-deleted, no newer activity

    const list = byRecipient.get(p.user_id) ?? []
    list.push({ conversationId: p.conversation_id, peerId: latest.sender_id })
    byRecipient.set(p.user_id, list)
  }

  if (byRecipient.size === 0) return NextResponse.json({ success: true, eligible: 0, sent: 0 })

  // 4. Resolve recipient prefs/emails + peer display names.
  const recipientIds = Array.from(byRecipient.keys())
  const peerIds = Array.from(new Set(Array.from(byRecipient.values()).flat().map((e) => e.peerId)))
  const allProfileIds = Array.from(new Set([...recipientIds, ...peerIds]))

  const { data: profileRows } = await admin
    .from('profiles')
    .select('id, username, display_name, email_new_message')
    .in('id', allProfileIds)
  const profById = new Map((profileRows ?? []).map((p) => [p.id, p]))

  const { data: authUserList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  for (const u of authUserList?.users ?? []) {
    if (recipientIds.includes(u.id) && u.email) emailById.set(u.id, u.email)
  }

  const nameOf = (id: string): string => {
    const p = profById.get(id)
    return p?.display_name?.trim() || p?.username || 'A member'
  }

  const messagesUrl = `${siteUrl}/account/messages`
  const manageUrl = `${siteUrl}/account/settings`

  let sent = 0
  let skipped = 0

  // 5. One digest per recipient who hasn't opted out.
  for (const [recipientId, items] of byRecipient) {
    if (profById.get(recipientId)?.email_new_message === false) { skipped++; continue }
    const email = emailById.get(recipientId)
    if (!email) { skipped++; continue }

    const senderNames = Array.from(new Set(items.map((e) => nameOf(e.peerId))))
    const result = await sendEmail({
      to: email,
      subject: senderNames.length === 1
        ? `New message from ${senderNames[0]}`
        : 'You have unread messages on Boss Daddy',
      tag: 'new_message',
      react: React.createElement(NewMessageEmail, {
        senderNames,
        conversationCount: items.length,
        messagesUrl,
        manageUrl,
        siteUrl,
      }),
    })

    if (!result.ok) { skipped++; continue }
    sent++
    // Stamp the debounce marker only for the conversations we just covered.
    for (const e of items) {
      await admin
        .from('conversation_participants')
        .update({ last_notified_at: nowIso })
        .eq('conversation_id', e.conversationId)
        .eq('user_id', recipientId)
    }
  }

  return NextResponse.json({ success: true, eligible: byRecipient.size, sent, skipped, sentAt: nowIso })
}
