'use client'

// "Message" button on author/profile pages. Opens (or creates) a DM and
// navigates to the thread. Render only for logged-in viewers who aren't the
// profile owner (gate in the parent server component).

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateDm } from '@/lib/messaging'

export default function MessageUserButton({ targetUserId }: { targetUserId: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Self-gate so the host page can stay static: only show to logged-in viewers
  // who aren't the profile owner.
  const [show, setShow] = useState(false)
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      setShow(!!uid && uid !== targetUserId)
    })
  }, [targetUserId])
  if (!show) return null

  async function start() {
    setBusy(true); setError(null)
    const res = await getOrCreateDm(targetUserId)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.data) window.location.assign(`/account/messages/${res.data.conversationId}`)
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
