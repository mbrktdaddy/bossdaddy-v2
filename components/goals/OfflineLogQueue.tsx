'use client'

// Logging when the signal drops — the narrow version, deliberately.
//
// THE DECISION THIS ENCODES. The full version caches /today in the service worker
// so the page opens with no connection at all. Two reasons we didn't:
//
//   1. STALENESS, which is the real objection and not the privacy one. `sw.js` has
//      warned about it since Phase 4: a cached /today can show an occurrence he
//      already logged. client_entry_id makes the FLUSH idempotent but cannot stop
//      the DISPLAY from lying, and "you still owe your 8pm dose" when he took it is
//      a worse failure on a medication app than "this page needs signal".
//   2. Caching a list of someone's medication and cessation schedule to disk on a
//      family phone is a real trade. Smaller than it first looks — if the session
//      is live, anyone holding the unlocked phone can load /today from the network
//      anyway — but it isn't nothing, and it buys less than it costs.
//
// So this covers the common case instead: HE OPENED THE APP, THEN LOST SIGNAL.
// Garage, basement, job site. No cached page, no service-worker change, no private
// data written anywhere.
//
// WHAT ACTUALLY GOES IN localStorage: an occurrence UUID, 'completed' or
// 'skipped', and maybe a number. No goal title, no metric name, no identity
// statement. Someone reading this storage learns that a log is pending and
// nothing whatsoever about what it's for.
//
// If cold-open-offline ever turns out to matter, the full version is still
// available and this queue is most of it already.

import { useEffect, useState } from 'react'

const KEY = 'bd_goal_log_queue_v1'

type Queued = { occurrenceId: string; action: 'completed' | 'skipped'; value: number | null }

function read(): Queued[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Queued[]) : []
  } catch { return [] }
}

function write(items: Queued[]) {
  try {
    if (items.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(items))
  } catch { /* private mode, quota — the log is lost, which is the old behaviour */ }
}

export default function OfflineLogQueue() {
  const [pending, setPending] = useState(0)
  const [justSynced, setJustSynced] = useState(false)

  useEffect(() => {
    // ── catch a submit that can't go anywhere ────────────────────────────────
    //
    // Capture phase at document level, because the forms on /today are bound
    // straight to a Server Action and there is no per-form hook to attach to.
    // We only intervene when the browser already knows it's offline; anything
    // else falls through to the normal submission, so the online path is
    // completely untouched by this component.
    function onSubmit(event: SubmitEvent) {
      if (navigator.onLine) return
      const form = event.target as HTMLFormElement
      if (!(form instanceof HTMLFormElement)) return

      const data = new FormData(form)
      const occurrenceId = String(data.get('occurrenceId') ?? '')
      if (!occurrenceId) return                       // not one of ours

      event.preventDefault()

      // The submitter decides completed vs skipped — both buttons are name="action"
      // in the same form, so FormData alone can't tell them apart.
      const submitter = event.submitter as HTMLButtonElement | null
      const action = submitter?.value === 'skipped' ? 'skipped' : 'completed'
      const rawValue = data.get('value')
      const parsed = rawValue == null || String(rawValue).trim() === ''
        ? null : Number(rawValue)

      const next = read().filter((q) => q.occurrenceId !== occurrenceId)
      next.push({ occurrenceId, action, value: Number.isFinite(parsed) ? parsed : null })
      write(next)
      setPending(next.length)

      // Take the card off screen so it reads as done. It IS done, as far as he's
      // concerned — the only thing outstanding is our end of it.
      form.closest('div')?.setAttribute('data-queued', 'true')
      form.closest('div[class*="rounded"]')?.classList.add('opacity-40')
      form.querySelectorAll('button').forEach((b) => { b.disabled = true })
    }

    // ── drain ────────────────────────────────────────────────────────────────
    // Every outcome from the endpoint is final, so an entry is dropped whether it
    // was written, already resolved, or refused. Only a network failure keeps it.
    // Also does the initial read. Deliberately not a setState in the effect body —
    // localStorage doesn't exist during SSR, so the count can't be lazy initial
    // state either, and react-hooks/set-state-in-effect rightly objects to the
    // direct call. Doing it here means one code path owns `pending`.
    async function flush() {
      const items = read()
      setPending(items.length)
      if (items.length === 0) return
      const left: Queued[] = []
      for (const item of items) {
        try {
          const res = await fetch('/api/goals/log', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(item),
          })
          if (!res.ok && res.status !== 401) left.push(item)
        } catch {
          left.push(item)                              // still no signal
        }
      }
      write(left)
      setPending(left.length)
      if (left.length === 0 && items.length > 0) {
        setJustSynced(true)
        // Pull the fresh server state rather than patching the DOM by hand.
        setTimeout(() => window.location.reload(), 1200)
      }
    }

    document.addEventListener('submit', onSubmit, true)
    window.addEventListener('online', flush)
    void flush()                                       // anything left from last time

    return () => {
      document.removeEventListener('submit', onSubmit, true)
      window.removeEventListener('online', flush)
    }
  }, [])

  if (pending === 0 && !justSynced) return null

  return (
    <div
      role="status"
      className="mt-6 rounded-xl border border-strong bg-surface-raised px-4 py-3 text-sm text-prose"
    >
      {justSynced ? (
        <>Caught up. Everything you logged is saved.</>
      ) : (
        <>
          <span className="font-semibold">
            {pending === 1 ? 'One log is waiting' : `${pending} logs are waiting`}
          </span>{' '}
          <span className="text-prose-muted">
            — no signal right now. Saved on this phone; it&apos;ll go up on its own
            when you&apos;re back.
          </span>
        </>
      )}
    </div>
  )
}
