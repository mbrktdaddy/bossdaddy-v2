'use client'

// Search members by username, display name, or an exact email address, then
// either open a DM or ask to connect. Forgiving of a leading "@" (usernames
// display as @name everywhere).
//
// MESSAGING NOW REQUIRES AN ACCEPTED CONNECTION (migration 140), so this can no
// longer assume a click means "open a thread". The search route returns
// `connectionState` per result and the row renders the verb that actually
// applies — Message, Connect, or a disabled "Asked". Letting the click through
// and surfacing the error instead would be a worse version of the same
// information, delivered after the fact.

import { useState, useRef } from 'react'
import Image from 'next/image'
import { getOrCreateDm } from '@/lib/messaging'

type ConnectionState = 'none' | 'pending_in' | 'pending_out' | 'accepted' | 'declined' | 'blocked'

interface Member {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  connectionState: ConnectionState
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
            <div key={m.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-9 h-9 rounded-full overflow-hidden bg-accent/15 flex items-center justify-center shrink-0">
                {m.avatarUrl ? (
                  <Image src={m.avatarUrl} alt="" width={36} height={36} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <span className="text-sm font-black text-accent">{(m.displayName || m.username || '?')[0]?.toUpperCase()}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-prose truncate">{m.displayName || m.username}</span>
                <span className="block text-xs text-prose-faint truncate">@{m.username}</span>
              </span>

              {/* The verb that actually applies. Connecting is a plain form POST —
                  no client JS, and a real navigation, which is what works on
                  mobile + PWA. Only Message needs the RPC round trip. */}
              {m.connectionState === 'accepted' ? (
                <button
                  type="button"
                  onClick={() => startDm(m)}
                  disabled={busy}
                  className="shrink-0 min-h-11 rounded-lg bg-accent px-4 py-2.5 text-xs font-bold text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
                >
                  Message
                </button>
              ) : m.connectionState === 'pending_out' ? (
                <span className="shrink-0 px-3 py-2.5 text-xs font-semibold text-faint">Asked</span>
              ) : m.connectionState === 'pending_in' ? (
                <ConnectForm userId={m.id} op="accept" label="Accept" />
              ) : (
                <ConnectForm userId={m.id} op="request" label="Connect" />
              )}
            </div>
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

/**
 * A one-button form posting to /api/connections. Deliberately a real form rather
 * than a fetch: it needs no JavaScript, it survives the mobile/PWA navigation
 * quirks the sign-in flow already works around, and the 303 lands the user on
 * /account/connections where the request they just sent is visible.
 */
function ConnectForm({ userId, op, label }: { userId: string; op: string; label: string }) {
  return (
    <form action="/api/connections" method="post" className="shrink-0">
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-strong bg-surface px-4 py-2.5 text-xs font-bold text-accent-text hover:bg-surface-hover transition-colors"
      >
        {label}
      </button>
    </form>
  )
}
