'use client'

// Search members by username/display name and open a DM with one. Forgiving of
// a leading "@" (usernames display as @name everywhere). Uses getOrCreateDm,
// then hard-navigates to the thread.

import { useState, useRef } from 'react'
import Image from 'next/image'
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
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(value: string) {
    setQ(value)
    setError(null)
    if (debounce.current) clearTimeout(debounce.current)
    const term = value.trim().replace(/^@+/, '') // @ is optional
    if (term.length < 2) { setResults([]); setSearched(false); return }
    debounce.current = setTimeout(async () => {
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(term)}`)
      if (!res.ok) { setResults([]); setSearched(true); return }
      const json = await res.json()
      setResults(json.members ?? [])
      setSearched(true)
    }, 250)
  }

  async function startDm(m: Member) {
    setBusy(true); setError(null)
    const res = await getOrCreateDm(m.id)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    if (res.data) window.location.assign(`/account/messages/${res.data.conversationId}`)
  }

  const term = q.trim().replace(/^@+/, '')

  return (
    <div className="relative">
      <input
        type="text"
        value={q}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by name or @username…"
        className="w-full px-4 py-2.5 bg-surface border border-strong rounded-xl text-sm text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
      />
      <p className="mt-1.5 text-xs text-prose-faint">Type a name or username — the @ is optional.</p>
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
              <span className="w-9 h-9 rounded-full overflow-hidden bg-accent/15 flex items-center justify-center shrink-0">
                {m.avatarUrl ? (
                  <Image src={m.avatarUrl} alt="" width={36} height={36} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <span className="text-sm font-black text-accent">{(m.displayName || m.username || '?')[0]?.toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-prose truncate">{m.displayName || m.username}</span>
                <span className="block text-xs text-prose-faint truncate">@{m.username}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {searched && results.length === 0 && term.length >= 2 && !error && (
        <p className="mt-2 text-sm text-prose-faint text-center py-3 border border-soft rounded-xl">
          No members found for &ldquo;{term}&rdquo;.
        </p>
      )}
    </div>
  )
}
