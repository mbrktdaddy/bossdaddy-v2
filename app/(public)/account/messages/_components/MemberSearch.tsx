'use client'

// Search members by username/display name and open a DM with one. Uses the
// getOrCreateDm server action, then hard-navigates to the thread.

import { useState, useRef } from 'react'
import { getOrCreateDm } from '@/lib/messaging'

interface Member {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export default function MemberSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(value: string) {
    setQ(value)
    setError(null)
    if (debounce.current) clearTimeout(debounce.current)
    if (value.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(value.trim())}`)
      if (!res.ok) return
      const json = await res.json()
      setResults(json.members ?? [])
    }, 250)
  }

  async function startDm(m: Member) {
    setBusy(true); setError(null)
    const res = await getOrCreateDm(m.id)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.data) window.location.assign(`/account/messages/${res.data.conversationId}`)
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search members to message…"
        className="w-full px-4 py-2.5 bg-surface border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
      />
      {error && <p className="text-xs text-danger-ink mt-1.5">{error}</p>}
      {results.length > 0 && (
        <div className="mt-2 border border-soft rounded-xl overflow-hidden divide-y divide-soft">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => startDm(m)}
              disabled={busy}
              className="flex items-center gap-3 w-full text-left px-4 py-2.5 hover:bg-surface-raised disabled:opacity-50 transition-colors"
            >
              <span className="text-sm font-semibold text-prose">{m.displayName || m.username}</span>
              <span className="text-xs text-prose-faint">@{m.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
