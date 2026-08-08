'use client'

// The Message / Connect button on author profile pages.
//
// WHY EVERYTHING HERE IS CLIENT-SIDE: the host page (app/(public)/author/
// [username]) is statically generated with revalidate = 3600 and is the same
// HTML for every visitor. It therefore cannot know who is looking, let alone
// where they stand with this person. So this component resolves both for itself —
// it already self-gated on auth for exactly that reason, and the connection state
// rides along on the same trip.
//
// Messaging requires an accepted connection (migration 140), so the verb changes:
// Message when connected, Connect when not, Asked while waiting. Rendering
// "Message" and letting it fail would tell the viewer the same thing a beat too
// late, after they'd already committed to the click.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateDm } from '@/lib/messaging'

type State = 'loading' | 'hidden' | 'none' | 'pending_in' | 'pending_out' | 'accepted' | 'blocked'

export default function MessageUserButton({ targetUserId }: { targetUserId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id
      if (!uid || uid === targetUserId) { if (!cancelled) setState('hidden'); return }

      // One RPC answers the whole question, block precedence included. Reusing
      // the SQL function rather than reconstructing the rules in the browser is
      // what keeps the silent-decline masking honest — see migration 141.
      const { data: rpc, error: rpcError } = await supabase
        .rpc('connection_state_with', { _other: targetUserId })
      if (cancelled) return

      if (rpcError) { setState('none'); return }
      const s = (rpc as string) ?? 'none'
      // 'declined' never reaches the requester (141 masks it), and a blocked pair
      // gets no affordance at all.
      setState(s === 'blocked' ? 'hidden' : (s as State))
    })

    return () => { cancelled = true }
  }, [targetUserId])

  if (state === 'loading' || state === 'hidden') return null

  async function start() {
    setBusy(true); setError(null)
    const res = await getOrCreateDm(targetUserId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.data) window.location.assign(`/account/messages/${res.data.conversationId}`)
  }

  if (state === 'pending_out') {
    return <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-faint">Asked</span>
  }

  if (state !== 'accepted') {
    // A plain form: no JS needed, a real navigation (which is what survives
    // mobile + PWA), and the 303 lands them on /account/connections where the
    // request is visible.
    return (
      <form action="/api/connections" method="post" className="inline-block">
        <input type="hidden" name="op" value={state === 'pending_in' ? 'accept' : 'request'} />
        <input type="hidden" name="userId" value={targetUserId} />
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          {state === 'pending_in' ? 'Accept' : 'Connect'}
        </button>
      </form>
    )
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        {busy ? 'Opening…' : 'Message'}
      </button>
      {error && <span className="text-xs text-danger-ink">{error}</span>}
    </span>
  )
}
