'use client'

// Unified "Activity" inbox — merges notifications + messages into ONE header
// surface: a single bell icon, a single combined unread badge, and a tabbed
// dropdown (Notifications | Messages). Replaces the separate NotificationBell
// + MessagesMenu so the top bar isn't two near-identical confusable icons.
//
// Realtime channels are created synchronously from the `userId` prop (no async
// getUser race) with a unique topic per mount — same fix as the old split
// components, kept here. Styled with explicit zinc-dark classes to sit
// cohesively next to the account dropdown in the dark header (and the dark
// dashboard nav).

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface NotificationRow {
  id:              string
  type:            string
  title:           string
  body:            string | null
  link:            string | null
  payload:         Record<string, unknown> | null
  action_required: boolean
  action_state:    string | null
  read_at:         string | null
  created_at:      string
}

interface ConversationSummary {
  id:          string
  peer:        { id: string; username: string; displayName: string | null; avatarUrl: string | null } | null
  lastMessage: { body: string; createdAt: string; fromMe: boolean } | null
  unread:      boolean
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function ActivityMenu({ userId }: { userId: string }) {
  const [open, setOpen]   = useState(false)
  const [tab, setTab]     = useState<'notifications' | 'messages'>('notifications')
  const [notifs, setNotifs]         = useState<NotificationRow[]>([])
  const [notifUnread, setNotifUnread] = useState(0)
  const [convs, setConvs]           = useState<ConversationSummary[]>([])
  const [msgUnread, setMsgUnread]   = useState(0)
  const [busyId, setBusyId]         = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const loadNotifs = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const j = await res.json()
    setNotifs(j.notifications ?? [])
    setNotifUnread(j.unread ?? 0)
  }, [])

  const loadMsgs = useCallback(async () => {
    const res = await fetch('/api/messages/conversations')
    if (!res.ok) return
    const j = await res.json()
    setConvs(j.conversations ?? [])
    setMsgUnread(j.unread ?? 0)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadNotifs(); loadMsgs() }, [loadNotifs, loadMsgs])

  // Realtime — notifications. Synchronous, unique topic (no getUser race).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => loadNotifs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, loadNotifs])

  // Realtime — messages (a new message bumps my conversation_participants row).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages-menu:${userId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` }, () => loadMsgs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, loadMsgs])

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Open to whichever tab has unread (messages only if notifs are clear).
  function toggleOpen() {
    setOpen((o) => {
      if (!o && notifUnread === 0 && msgUnread > 0) setTab('messages')
      return !o
    })
  }

  async function markRead(id: string) {
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setNotifUnread((u) => Math.max(0, u - 1))
    // keepalive: openNotif fires this then hard-navigates — without keepalive
    // the unload cancels the POST and the notification never persists as read.
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', keepalive: true })
  }

  async function markAll() {
    const ts = new Date().toISOString()
    setNotifs((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? ts })))
    setNotifUnread(0)
    await fetch('/api/notifications/read-all', { method: 'POST', keepalive: true })
  }

  // Optimistically clear a conversation's unread the moment it's opened, so the
  // badge updates instantly — the realtime conversation_participants UPDATE
  // (from markConversationRead on the thread page) reconciles it afterwards.
  function openConversation(c: ConversationSummary) {
    if (!c.unread) return
    setConvs((prev) => prev.map((x) => x.id === c.id ? { ...x, unread: false } : x))
    setMsgUnread((u) => Math.max(0, u - 1))
  }

  async function act(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    const res = await fetch(`/api/notifications/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusyId(null)
    if (!res.ok) { await loadNotifs(); return }
    const j = await res.json().catch(() => ({}))
    await loadNotifs()
    if (action === 'accept' && j.goalId) window.location.assign(`/tools/savings/${j.goalId}`)
  }

  function openNotif(n: NotificationRow) {
    if (!n.read_at) markRead(n.id)
    if (n.link) window.location.assign(n.link)
  }

  function peerName(c: ConversationSummary): string {
    return c.peer?.displayName || c.peer?.username || 'Member'
  }

  const totalUnread = notifUnread + msgUnread

  const tabBtn = (key: 'notifications' | 'messages', label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(key)}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        tab === key
          ? 'border-accent text-zinc-50'
          : 'border-transparent text-zinc-400 hover:text-zinc-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-accent rounded-full leading-none">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={totalUnread > 0 ? `Activity (${totalUnread} unread)` : 'Activity'}
        className="relative p-2 text-zinc-400 hover:text-zinc-50 rounded-lg hover:bg-zinc-800/60 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-accent rounded-full leading-none">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Tabs */}
          <div className="flex">
            {tabBtn('notifications', 'Notifications', notifUnread)}
            {tabBtn('messages', 'Messages', msgUnread)}
          </div>

          {tab === 'notifications' ? (
            <>
              {notifUnread > 0 && (
                <div className="flex justify-end px-4 py-1.5 border-b border-zinc-700">
                  <button type="button" onClick={markAll} className="text-xs text-accent-text hover:text-accent font-semibold">
                    Mark all read
                  </button>
                </div>
              )}
              <div className="max-h-[60vh] overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-zinc-400">You&apos;re all caught up.</p>
                ) : (
                  notifs.map((n) => {
                    const actionable = n.action_required && (!n.action_state || n.action_state === 'pending')
                    return (
                      <div key={n.id} className={`px-4 py-3 border-b border-zinc-700/60 last:border-0 ${n.read_at ? '' : 'bg-zinc-700/40'}`}>
                        <button type="button" onClick={() => openNotif(n)} className="block w-full text-left">
                          <div className="flex items-start gap-2">
                            {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-zinc-100 leading-snug">{n.title}</p>
                              {n.body && <p className="text-xs text-zinc-400 mt-0.5 leading-snug">{n.body}</p>}
                              <p className="text-[11px] text-zinc-500 mt-1">{shortDate(n.created_at)}</p>
                            </div>
                          </div>
                        </button>
                        {actionable && (
                          <div className="flex gap-2 mt-2 pl-4">
                            <button type="button" onClick={() => act(n.id, 'accept')} disabled={busyId === n.id}
                              className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                              {busyId === n.id ? '…' : 'Accept'}
                            </button>
                            <button type="button" onClick={() => act(n.id, 'decline')} disabled={busyId === n.id}
                              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 text-xs font-semibold rounded-lg transition-colors">
                              Decline
                            </button>
                          </div>
                        )}
                        {n.action_required && n.action_state && n.action_state !== 'pending' && (
                          <p className="text-[11px] text-zinc-500 mt-1.5 pl-4 capitalize">{n.action_state}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <Link href="/account/notifications" className="block px-4 py-2.5 text-center text-xs font-semibold text-accent-text hover:text-accent border-t border-zinc-700">
                View all notifications
              </Link>
            </>
          ) : (
            <>
              <div className="max-h-[60vh] overflow-y-auto">
                {convs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-zinc-400">No conversations yet.</p>
                ) : (
                  convs.slice(0, 8).map((c) => (
                    <Link key={c.id} href={`/account/messages/${c.id}`}
                      onClick={() => openConversation(c)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-zinc-700/60 last:border-0 hover:bg-zinc-700/50 transition-colors ${c.unread ? 'bg-zinc-700/40' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{peerName(c)}</p>
                        {c.lastMessage && (
                          <p className="text-xs text-zinc-400 truncate">
                            {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}
                          </p>
                        )}
                      </div>
                      {c.unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
                    </Link>
                  ))
                )}
              </div>
              <Link href="/account/messages" className="block px-4 py-2.5 text-center text-xs font-semibold text-accent-text hover:text-accent border-t border-zinc-700">
                All messages
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  )
}
