'use client'

// Header notification bell. Fetches the user's notifications, subscribes to
// Supabase Realtime for live inserts/updates (RLS scopes the stream to the
// user's own rows), and renders a dropdown with mark-read + inline
// Accept/Decline for actionable items (e.g. savings invites).

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

function shortDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen]     = useState(false)
  const [items, setItems]   = useState<NotificationRow[]>([])
  const [unread, setUnread] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const json = await res.json()
    setItems(json.notifications ?? [])
    setUnread(json.unread ?? 0)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  // Realtime — re-pull on any change to this user's notifications. Created
  // synchronously (uid comes from props, no async getUser race) with a unique
  // topic per mount, so a strict-mode remount can't re-attach handlers to an
  // already-subscribed channel (the "callbacks after subscribe()" crash).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { load() },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnread((u) => Math.max(0, u - 1))
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
  }

  async function markAll() {
    const ts = new Date().toISOString()
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? ts })))
    setUnread(0)
    await fetch('/api/notifications/read-all', { method: 'POST' })
  }

  async function act(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    const res = await fetch(`/api/notifications/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    setBusyId(null)
    if (!res.ok) { await load(); return }
    const json = await res.json().catch(() => ({}))
    await load()
    // Hard-nav after accepting (works on mobile + PWA where router.push can stall).
    if (action === 'accept' && json.goalId) window.location.assign(`/tools/savings/${json.goalId}`)
  }

  function openItem(n: NotificationRow) {
    if (!n.read_at) markRead(n.id)
    if (n.link) window.location.assign(n.link)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
        className="relative p-2 text-prose-muted hover:text-prose rounded-lg hover:bg-surface-raised transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-accent rounded-full leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface border border-soft rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-soft">
            <span className="text-sm font-bold text-prose">Notifications</span>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-xs text-accent hover:text-accent-hover font-semibold">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-prose-faint">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => {
                const actionable = n.action_required && (!n.action_state || n.action_state === 'pending')
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 border-b border-soft/60 last:border-0 ${n.read_at ? '' : 'bg-accent-tint/40'}`}
                  >
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-prose leading-snug">{n.title}</p>
                          {n.body && <p className="text-xs text-prose-muted mt-0.5 leading-snug">{n.body}</p>}
                          <p className="text-[11px] text-prose-faint mt-1">{shortDate(n.created_at)}</p>
                        </div>
                      </div>
                    </button>

                    {actionable && (
                      <div className="flex gap-2 mt-2 pl-4">
                        <button
                          type="button"
                          onClick={() => act(n.id, 'accept')}
                          disabled={busyId === n.id}
                          className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          {busyId === n.id ? '…' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => act(n.id, 'decline')}
                          disabled={busyId === n.id}
                          className="px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose-muted text-xs font-semibold rounded-lg transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {n.action_required && n.action_state && n.action_state !== 'pending' && (
                      <p className="text-[11px] text-prose-faint mt-1.5 pl-4 capitalize">{n.action_state}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>

          <Link
            href="/account/notifications"
            className="block px-4 py-2.5 text-center text-xs font-semibold text-accent hover:text-accent-hover border-t border-soft"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  )
}
