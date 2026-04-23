'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Revision {
  id: string
  version_number: number
  created_at: string
  profiles?: { username: string } | { username: string }[] | null
}

interface Props {
  contentType: 'article' | 'review'
  contentId: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function VersionHistoryPanel({ contentType, contentId }: Props) {
  const router = useRouter()
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reverting, setReverting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (loaded) return
    setLoading(true)
    const res = await fetch(`/api/revisions?content_type=${contentType}&content_id=${contentId}`)
    if (res.ok) {
      const json = await res.json()
      setRevisions(json.revisions ?? [])
      setLoaded(true)
    }
    setLoading(false)
  }

  async function handleRevert(revision_id: string, version: number) {
    if (!confirm(`Revert to version ${version}? Your current content will be snapshotted first so you can undo.`)) return
    setReverting(revision_id); setError(null)
    const res = await fetch('/api/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, content_id: contentId, revision_id }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Revert failed')
      setReverting(null)
      return
    }
    router.refresh()
    setReverting(null)
  }

  return (
    <details
      className="bg-gray-900 border border-gray-800 rounded-xl"
      onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) load() }}
    >
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-cyan-400">🕰️</span> Version history
        </span>
        <span className="text-xs text-gray-600">
          {loaded ? `${revisions.length} saved version${revisions.length !== 1 ? 's' : ''}` : 'Click to load'}
        </span>
      </summary>

      <div className="px-4 pb-4">
        {loading && (
          <div className="flex items-center gap-2 text-gray-500 py-4 text-sm">
            <div className="w-3 h-3 border-2 border-gray-700 border-t-orange-500 rounded-full animate-spin" />
            Loading history…
          </div>
        )}
        {loaded && revisions.length === 0 && (
          <p className="text-sm text-gray-600 py-3">No previous versions yet. Each time you save, the prior state is recorded here.</p>
        )}
        {loaded && revisions.length > 0 && (
          <div className="divide-y divide-gray-800 -mx-4">
            {revisions.map((r) => {
              const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
              const username = p?.username ?? 'unknown'
              return (
                <div key={r.id} className="px-4 py-2 flex items-center justify-between gap-3 hover:bg-gray-950/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-mono text-gray-300">v{r.version_number}</p>
                    <p className="text-xs text-gray-600">{timeAgo(r.created_at)} · @{username}</p>
                  </div>
                  <button
                    onClick={() => handleRevert(r.id, r.version_number)}
                    disabled={reverting === r.id}
                    className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-lg transition-colors"
                  >
                    {reverting === r.id ? '…' : '↻ Revert'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {error && (
          <p className="text-xs text-red-400 bg-red-950/50 border border-red-800 rounded px-3 py-2 mt-2">{error}</p>
        )}
      </div>
    </details>
  )
}
