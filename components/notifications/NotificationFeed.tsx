'use client'

// Full-page notification list for /account/notifications. Server-renders the
// initial rows; subscribes to Realtime for live updates; supports mark-read,
// mark-all-read, Accept/Decline for actionable items, and a select mode for
// bulk mark-read / delete.
//
// WHY SELECT MODE LIVES ONLY HERE, not in the header bell: the bell panel is
// w-80 on desktop AND mobile with a 60vh scroll. Checkboxes and a floating
// action bar inside 320px is worse than the mark-all-read + per-row ✓ it already
// has. The bell stays a glance surface; this page is the one that manages.
//
// A PENDING ACTIONABLE ROW IS NOT SELECTABLE. It's the only surface that can
// answer itself — a connection request has no requests page anywhere else — so
// deleting it would strip the only accept path. Migration 154 enforces that in
// the delete policy; this is the same rule made visible, and it matches the
// existing choice not to offer "Mark read" on an unanswered item either.

import { useEffect, useState, useCallback, useMemo } from 'react'
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

/** Unanswered and waiting on the user — the row that must not be deletable. */
function isPendingAction(n: NotificationRow): boolean {
  return n.action_required && (!n.action_state || n.action_state === 'pending')
}

export default function NotificationFeed({ initial }: { initial: NotificationRow[] }) {
  const [items, setItems]   = useState<NotificationRow[]>(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [bulkBusy, setBulkBusy]     = useState(false)
  const [notice, setNotice]         = useState<string | null>(null)

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
  const selectable = useMemo(() => items.filter((n) => !isPendingAction(n)), [items])

  // The selection is INTERSECTED with what's on screen at render rather than
  // synced in an effect. A row can leave under us — realtime delete, another tab,
  // an Accept that turns a row un-selectable — and a stale id would have the bar
  // saying "3 selected" with two rows visible, then acting on the ghost.
  const chosen = useMemo(() => {
    const live = new Set(selectable.map((n) => n.id))
    return [...selected].filter((id) => live.has(id))
  }, [selected, selectable])
  const chosenSet = useMemo(() => new Set(chosen), [chosen])
  const allSelected = selectable.length > 0 && chosen.length === selectable.length

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

  function exitSelectMode() {
    setSelectMode(false)
    setSelected(new Set())
    setConfirmingDelete(false)
  }

  function toggle(id: string) {
    setConfirmingDelete(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    setConfirmingDelete(false)
    setSelected(allSelected ? new Set() : new Set(selectable.map((n) => n.id)))
  }

  // Both bulk actions reconcile against what the SERVER says it touched rather
  // than assuming the request landed: migration 154 can refuse a delete by
  // removing zero rows and reporting no error, and an optimistic drop would show
  // the row gone until the next refetch put it back.
  async function bulk(action: 'read' | 'delete') {
    const ids = chosen
    if (ids.length === 0) return
    setBulkBusy(true)
    setNotice(null)
    const res = await fetch('/api/notifications/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    })
    setBulkBusy(false)
    setConfirmingDelete(false)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setNotice(err.error ?? 'That didn’t go through. Try again.')
      await load()
      return
    }
    const json = await res.json().catch(() => ({}))
    if (action === 'delete') {
      const deleted: string[] = json.deleted ?? []
      const blocked: string[] = json.blocked ?? []
      setItems((prev) => prev.filter((n) => !deleted.includes(n.id)))
      setNotice(
        blocked.length
          ? `Cleared ${deleted.length}. ${blocked.length} still need an answer first.`
          : null,
      )
    } else {
      const ts = new Date().toISOString()
      const read: string[] = json.read ?? []
      setItems((prev) => prev.map((n) => read.includes(n.id) ? { ...n, read_at: ts } : n))
    }
    setSelected(new Set())
    if (action === 'delete') setSelectMode(false)
    await load()
  }

  if (items.length === 0) {
    return <p className="text-sm text-prose-faint py-12 text-center">You&apos;re all caught up.</p>
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        {selectMode ? (
          <button
            type="button"
            onClick={toggleAll}
            disabled={selectable.length === 0}
            className="min-h-11 text-xs font-semibold text-accent hover:text-accent-hover disabled:opacity-40"
          >
            {allSelected ? 'Clear selection' : `Select all (${selectable.length})`}
          </button>
        ) : (
          <span className="text-xs text-prose-faint">
            {unread > 0 ? `${unread} unread` : 'All read'}
          </span>
        )}
        <div className="flex items-center gap-4">
          {!selectMode && unread > 0 && (
            <button type="button" onClick={markAll} className="min-h-11 text-xs text-accent hover:text-accent-hover font-semibold">
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            className="min-h-11 text-xs font-semibold text-prose-muted hover:text-prose"
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        </div>
      </div>

      {notice && <p className="text-xs text-accent-text">{notice}</p>}

      {items.map((n) => {
        const actionable = isPendingAction(n)
        const checked = chosenSet.has(n.id)
        const rowClass = `rounded-xl border p-4 ${
          checked ? 'border-accent bg-accent-tint/40'
            : n.read_at ? 'border-soft bg-surface'
            : 'border-accent-border/50 bg-accent-tint/40'
        }`

        // In select mode the whole card is the tap target (a <label> wrapping the
        // checkbox), because a 20px box is not a 44px target on a phone. Links and
        // Accept/Decline are suppressed there — a card can't be both a navigation
        // and a checkbox without one of them firing by accident.
        const content = (
          <div className="flex items-start gap-3">
            {selectMode ? (
              actionable ? (
                <span className="mt-0.5 w-5 h-5 shrink-0 rounded border border-soft opacity-40" aria-hidden />
              ) : (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(n.id)}
                  className="mt-0.5 w-5 h-5 shrink-0 accent-accent"
                  aria-label={`Select “${n.title}”`}
                />
              )
            ) : (
              !n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-prose">{n.title}</p>
              {n.body && <p className="text-sm text-prose-muted mt-0.5">{n.body}</p>}
              <p className="text-xs text-prose-faint mt-1">{fmt(n.created_at)}</p>

              {selectMode ? (
                actionable && (
                  <p className="text-xs text-prose-faint mt-2">
                    Answer this one first — accepting or declining is only possible here.
                  </p>
                )
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>
        )

        return selectMode && !actionable ? (
          <label key={n.id} className={`${rowClass} block cursor-pointer`}>{content}</label>
        ) : (
          <div key={n.id} className={rowClass}>{content}</div>
        )
      })}

      {/* Sticky on mobile so the bar is reachable without scrolling back up a long
          feed; it breaks out of the page's px-4 and restores the padding inside. */}
      {selectMode && (
        <div className="sticky bottom-0 -mx-4 border-t border-strong bg-chrome/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-prose-muted">
              {chosen.length} selected
            </span>
            <div className="flex items-center gap-2">
              {confirmingDelete ? (
                <>
                  <button type="button" onClick={() => setConfirmingDelete(false)}
                    className="px-3 py-2.5 text-xs font-semibold text-prose-muted hover:text-prose">
                    Keep them
                  </button>
                  <button type="button" onClick={() => bulk('delete')} disabled={bulkBusy}
                    className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-xs font-semibold transition-colors">
                    {bulkBusy ? '…' : `Delete ${chosen.length}`}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => bulk('read')} disabled={bulkBusy || chosen.length === 0}
                    className="px-4 py-2.5 rounded-lg border border-soft bg-surface hover:bg-surface-hover disabled:opacity-40 text-xs font-semibold text-prose transition-colors">
                    Mark read
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(true)} disabled={bulkBusy || chosen.length === 0}
                    className="px-4 py-2.5 rounded-lg border border-soft bg-surface hover:bg-surface-hover disabled:opacity-40 text-xs font-semibold text-prose-muted transition-colors">
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
