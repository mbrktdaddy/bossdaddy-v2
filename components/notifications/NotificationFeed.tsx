'use client'

// Full-page notification list for /account/notifications. Server-renders the
// initial rows; subscribes to Realtime for live updates; supports mark-read,
// mark-all-read, and Accept/Decline for actionable items.

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface NotificationRow {
  id:              string
  type:            string
  title:           string
  body:            string | null
  link:            string | null
  payload:         unknown
  action_required: boolean
  action_state:    string | null
  read_at:         string | null
  created_at:      string
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NotificationFeed({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems]   = useState<NotificationRow[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const json = await res.json()
    setItems(json.notifications ?? [])
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid || cancelled) return
      channel = supabase
        .channel(`notifications-feed:${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => load())
        .subscribe()
    })
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel) }
  }, [load])

  // Reconcile on return-to-page — mobile/PWA suspends the realtime socket when
  // backgrounded or navigating, so refetch on visibility/focus/bfcache restore.
  useEffect(() => {
    function refresh() { if (document.visibilityState !== 'hidden') load() }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [load])

  const unread = items.filter((n) => !n.read_at).length

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
  }
  async function markAll() {
    const ts = new Date().toISOString()
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? ts })))
    await fetch('/api/notifications/read-all', { method: 'POST' })
  }
  async function act(id: string, action: 'accept' | 'decline') {
    setBusyId(id)
    const res = await fetch(`/api/notifications/${id}/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    setBusyId(null)
    if (!res.ok) { await load(); return }
    const json = await res.json().catch(() => ({}))
    await load()
    if (action === 'accept' && json.goalId) window.location.assign(`/tools/savings/${json.goalId}`)
  }

  if (items.length === 0) {
    return <p className="text-sm text-prose-faint py-12 text-center">You&apos;re all caught up.</p>
  }

  return (
    <div className="space-y-2">
      {unread > 0 && (
        <div className="flex justify-end">
          <button type="button" onClick={markAll} className="text-xs text-accent hover:text-accent-hover font-semibold">
            Mark all read
          </button>
        </div>
      )}
      {items.map((n) => {
        const actionable = n.action_required && (!n.action_state || n.action_state === 'pending')
        return (
          <div key={n.id} className={`rounded-xl border p-4 ${n.read_at ? 'border-soft bg-surface' : 'border-accent-border/50 bg-accent-tint/40'}`}>
            <div className="flex items-start gap-3">
              {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-prose">{n.title}</p>
                {n.body && <p className="text-sm text-prose-muted mt-0.5">{n.body}</p>}
                <p className="text-xs text-prose-faint mt-1">{fmt(n.created_at)}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {n.link && (
                    <a href={n.link} onClick={() => !n.read_at && markRead(n.id)} className="text-xs font-semibold text-accent hover:text-accent-hover">
                      Open →
                    </a>
                  )}
                  {!n.read_at && !actionable && (
                    <button type="button" onClick={() => markRead(n.id)} className="text-xs text-prose-faint hover:text-prose">
                      Mark read
                    </button>
                  )}
                </div>
                {actionable && (
                  <div className="flex gap-2 mt-2">
                    <button type="button" onClick={() => act(n.id, 'accept')} disabled={busyId === n.id}
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors">
                      {busyId === n.id ? '…' : 'Accept'}
                    </button>
                    <button type="button" onClick={() => act(n.id, 'decline')} disabled={busyId === n.id}
                      className="px-3 py-1.5 bg-surface-raised hover:bg-surface disabled:opacity-40 text-prose-muted text-xs font-semibold rounded-lg transition-colors">
                      Decline
                    </button>
                  </div>
                )}
                {n.action_required && n.action_state && n.action_state !== 'pending' && (
                  <p className="text-xs text-prose-faint mt-1.5 capitalize">{n.action_state}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
