'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CommentActions({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function act(action: 'approve' | 'reject') {
    setLoading(action); setError(null)
    const res = await fetch(`/api/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Action failed')
      setLoading(null)
      return
    }
    router.refresh()
    setLoading(null)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => act('approve')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 hover:bg-green-50 disabled:opacity-50 text-forest border border-green-200 transition-colors"
      >
        {loading === 'approve' ? '…' : '✓ Approve'}
      </button>
      <button
        onClick={() => act('reject')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-50 disabled:opacity-50 text-red-600 border border-red-200 transition-colors"
      >
        {loading === 'reject' ? '…' : '✗ Reject'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
