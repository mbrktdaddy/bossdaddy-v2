'use client'

// Unified "Activity" inbox — merges notifications + messages into ONE header
// surface: a single bell icon, a single combined unread badge, and a tabbed
// dropdown (Notifications | Messages). Replaces the separate NotificationBell
// + MessagesMenu so the top bar isn't two near-identical confusable icons.
//
// Realtime channels are created synchronously from the `userId` prop (no async
// getUser race) with a unique topic per mount — same fix as the old split
// components, kept here.
//
// COMPOSED FROM THE MENU PRIMITIVES, NOT <Menu>: this panel needs to know when it
// opens (to land on whichever tab has unread), so it owns `useDisclosure` and
// hands it to <MenuPanel>. Open/close, Esc, outside-press and close-on-navigation
// all come from the hook — nothing here re-implements them. The header is a
// `data-theme="dark"` zone, so the panel inherits the dark tokens and its 2px
// white edge (the overlay recipe) with no colour classes of its own.

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { activityTime } from '@/lib/activity-time'
import { LABELS } from '@/lib/labels'
import { useDisclosure } from '@/lib/hooks/useDisclosure'
import { buttonVariants } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { CountBadge, UnreadDot } from '@/components/ui/CountBadge'
import { MenuPanel, MenuTabs, MenuDivider, MenuFooterLink } from '@/components/ui/Menu'
import { CheckIcon } from '@/components/icons'

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
  unreadCount: number
  muted:       boolean
}

interface ActivityMenuProps {
  userId: string
  /**
   * `end` (default) is the HEADER mount: the panel opens in the masthead slot —
   * one line under the orange rule, flush with the right gutter, the same line
   * Account and Topics use (`placement="masthead"`). `start` is the dashboard
   * sidebar, where the bell sits at the left of a 240px rail: there the panel
   * must hang off the bell's LEFT edge (`placement="trigger"`), because a
   * masthead-positioned panel would resolve against the sidebar, not a header.
   * Phones ignore both (the panel is pinned to the viewport under the masthead).
   */
  align?: 'start' | 'end'
}

// Row recipe shared by both tabs. Hover is its own fill (surface-hover), distinct
// from the unread fill (surface-raised) — on the old panel hover was `surface`,
// i.e. the panel's own colour, so rows had no hover at all.
const ROW = 'border-b border-soft last:border-0 hover:bg-surface-hover transition-colors'

export default function ActivityMenu({ userId, align = 'end' }: ActivityMenuProps) {
  const disclosure = useDisclosure()
  const [tab, setTab]     = useState<'notifications' | 'messages'>('notifications')
  const [notifs, setNotifs]         = useState<NotificationRow[]>([])
  const [notifUnread, setNotifUnread] = useState(0)
  const [convs, setConvs]           = useState<ConversationSummary[]>([])
  const [msgUnread, setMsgUnread]   = useState(0)
  const [busyId, setBusyId]         = useState<string | null>(null)

  const loadNotifs = useCallback(async () => {
    const res = await fetch('/api/notifications', { cache: 'no-store' })
    if (!res.ok) return
    const j = await res.json()
    setNotifs(j.notifications ?? [])
    setNotifUnread(j.unread ?? 0)
  }, [])

  const loadMsgs = useCallback(async () => {
    const res = await fetch('/api/messages/conversations', { cache: 'no-store' })
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

  // Reconcile on return-to-page. Mobile browsers (and the PWA in standalone)
  // suspend the realtime websocket when the page is backgrounded or during
  // navigation, so the live badge-clear never arrives and already-read items
  // "reappear" until a hard reload. Refetch from the DB whenever the page
  // becomes visible/focused again — including bfcache restores (pageshow).
  useEffect(() => {
    function refresh() {
      if (document.visibilityState !== 'hidden') { loadNotifs(); loadMsgs() }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [loadNotifs, loadMsgs])

  // Open to whichever tab has unread (messages only if notifs are clear). Close-on-
  // route-change and outside-press are the disclosure's job, not ours.
  function toggleOpen() {
    if (!disclosure.open && notifUnread === 0 && msgUnread > 0) setTab('messages')
    disclosure.toggle()
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
    setConvs((prev) => prev.map((x) => x.id === c.id ? { ...x, unread: false, unreadCount: 0 } : x))
    // A muted thread was never in the badge, so opening it can't decrement one.
    if (!c.muted) setMsgUnread((u) => Math.max(0, u - 1))
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
  const placement = align === 'start' ? 'trigger' : 'masthead'

  return (
    // Masthead: NO `relative` here — the panel must position against the header's
    // own `relative h-16` container, or it opens at this trigger's height and x.
    // `flex` so the wrapper is exactly the button's 44px (a block wrapper around an
    // inline-flex button adds a baseline gap).
    <div className={placement === 'masthead' ? 'flex' : 'relative flex'}>
      <IconButton
        {...disclosure.triggerProps}
        onClick={toggleOpen}
        label={totalUnread > 0 ? `Activity, ${totalUnread} unread` : 'Activity'}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <CountBadge count={totalUnread} className="absolute -top-0.5 -right-0.5" />
      </IconButton>

      {disclosure.open && (
        // Phones: pinned under the masthead (`pinOnPhone`) — the bell sits left of
        // the search + menu icons, so a panel anchored to its right edge would run
        // off the LEFT of the screen. sm+: the masthead slot (or, in the dashboard
        // rail, the trigger's left edge).
        <MenuPanel disclosure={disclosure} label="Activity" width="feed" pinOnPhone align={align} placement={placement}>
          <MenuTabs
            label="Activity"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'notifications', label: LABELS.notifications.short, count: notifUnread },
              { value: 'messages',      label: LABELS.messages.short,      count: msgUnread },
            ]}
          />

          {tab === 'notifications' ? (
            <>
              {notifUnread > 0 && (
                <div className="-mx-1.5 flex justify-end px-3 border-b border-soft">
                  <button
                    type="button"
                    onClick={markAll}
                    className="inline-flex items-center min-h-11 px-3 rounded-md text-xs font-semibold text-accent-text hover:bg-surface-hover transition-colors"
                  >
                    Mark all read
                  </button>
                </div>
              )}
              <div className="-mx-1.5 max-h-[60vh] overflow-y-auto">
                {notifs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-prose-muted">{LABELS.notifications.empty}</p>
                ) : (
                  notifs.map((n) => {
                    const actionable = n.action_required && (!n.action_state || n.action_state === 'pending')
                    return (
                      // Unread = a row fill + the dot. The dot is ALWAYS mounted
                      // (transparent once read) so marking a row read never shifts
                      // its text sideways; the check slot is held for the same reason.
                      <div key={n.id} className={`pl-4 pr-2 py-3 ${ROW} ${n.read_at ? '' : 'bg-surface-raised'}`}>
                        <div className="flex items-start gap-3">
                          <UnreadDot unread={!n.read_at} className="mt-1.5" />
                          <button type="button" onClick={() => openNotif(n)} className="block flex-1 min-w-0 text-left">
                            <p className="text-sm font-semibold text-prose leading-snug">{n.title}</p>
                            {n.body && <p className="text-xs text-prose-muted mt-0.5 leading-snug">{n.body}</p>}
                            <p className="text-[11px] text-prose-faint mt-1">{activityTime(n.created_at)}</p>
                          </button>
                          {n.read_at ? (
                            <span aria-hidden className="w-11 shrink-0 -mr-2" />
                          ) : (
                            // 44px target in a ~60px row: the negative margins let the
                            // button overhang the row's padding instead of growing it.
                            <IconButton
                              label="Mark as read"
                              title="Mark as read"
                              onClick={() => markRead(n.id)}
                              className="-my-3 -mr-2"
                            >
                              <CheckIcon className="w-4 h-4" strokeWidth={2} />
                            </IconButton>
                          )}
                        </div>
                        {actionable && (
                          // pl-5 = the dot (8px) + its gap (12px): buttons line up under the text.
                          <div className="flex gap-2 mt-2 pl-5">
                            <button type="button" onClick={() => act(n.id, 'accept')} disabled={busyId === n.id}
                              className={buttonVariants({ size: 'md' })}>
                              {busyId === n.id ? '…' : 'Accept'}
                            </button>
                            <button type="button" onClick={() => act(n.id, 'decline')} disabled={busyId === n.id}
                              className={buttonVariants({ variant: 'outline', size: 'md' })}>
                              Decline
                            </button>
                          </div>
                        )}
                        {n.action_required && n.action_state && n.action_state !== 'pending' && (
                          <p className="text-[11px] text-prose-faint mt-1.5 pl-5 capitalize">{n.action_state}</p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <MenuDivider />
              <MenuFooterLink href="/account/notifications">View all notifications</MenuFooterLink>
            </>
          ) : (
            <>
              <div className="-mx-1.5 max-h-[60vh] overflow-y-auto">
                {convs.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-prose-muted">No conversations yet.</p>
                ) : (
                  convs.slice(0, 8).map((c) => (
                    <Link key={c.id} href={`/account/messages/${c.id}`}
                      onClick={() => openConversation(c)}
                      className={`flex items-center gap-3 px-4 py-3 ${ROW} ${c.unread && !c.muted ? 'bg-surface-raised' : ''}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-semibold text-prose truncate">{peerName(c)}</p>
                          {/* Same formatter as the full list — two surfaces showing
                              one thread's last activity must not disagree about when
                              it was. */}
                          {c.lastMessage && (
                            <span className="ml-auto shrink-0 text-[11px] text-prose-faint tabular-nums">
                              {activityTime(c.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        {c.lastMessage && (
                          <p className="text-xs text-prose-muted truncate">
                            {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}
                          </p>
                        )}
                      </div>
                      {c.unreadCount > 0 && (
                        // A muted thread's count is information, not an alert.
                        <CountBadge count={c.unreadCount} tone={c.muted ? 'muted' : 'accent'} className="shrink-0" />
                      )}
                    </Link>
                  ))
                )}
              </div>
              <MenuDivider />
              <MenuFooterLink href="/account/messages">All messages</MenuFooterLink>
            </>
          )}
        </MenuPanel>
      )}
    </div>
  )
}
