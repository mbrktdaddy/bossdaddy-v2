'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  status: string
  contentType: 'reviews' | 'articles'
}

export default function ContentActions({ id, status, contentType }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!confirm('Delete this permanently? This cannot be undone.')) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/${contentType}/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Delete failed — please try again.')
      setLoading(false)
      return
    }
    router.refresh()
  }

  async function handleRecall() {
    if (!confirm('Pull this back to draft? It will be removed from the review queue and you can edit it again.')) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/${contentType}/${id}`, { method: 'PATCH' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Recall failed — please try again.')
      setLoading(false)
      return
    }
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === 'pending' && (
        <button
          onClick={handleRecall}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-amber-950/40 hover:bg-amber-950/40 text-amber-300 hover:text-amber-300 rounded-lg transition-colors border border-amber-700/40 disabled:opacity-40"
        >
          {loading ? '…' : 'Recall to draft'}
        </button>
      )}
      {(status === 'draft' || status === 'rejected') && (
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 bg-red-950/40 hover:bg-red-100 text-red-300 hover:text-red-300 rounded-lg transition-colors border border-red-700/40 disabled:opacity-40"
        >
          {loading ? '…' : 'Delete'}
        </button>
      )}
      {error && (
        <span className="text-xs text-red-300">{error}</span>
      )}
    </div>
  )
}
