'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  type: 'review' | 'article'
  isVisible: boolean
}

export function UnpublishButton({ id, type }: { id: string; type: 'review' | 'article' }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleUnpublish() {
    setLoading(true)
    await fetch(`/api/${type === 'review' ? 'reviews' : 'articles'}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unpublish' }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleUnpublish}
      disabled={loading}
      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-950/50 hover:bg-red-900/60 disabled:opacity-50 text-red-400 border border-red-900/40 transition-colors"
    >
      {loading ? '...' : 'Unpublish'}
    </button>
  )
}

export function CommentModerationActions({ id }: { id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)

  async function act(action: 'approve' | 'reject') {
    setLoading(action)
    await fetch(`/api/comments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    router.refresh()
    setLoading(null)
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => act('approve')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-950/50 hover:bg-green-900/60 disabled:opacity-50 text-green-400 border border-green-900/40 transition-colors"
      >
        {loading === 'approve' ? '...' : 'Approve'}
      </button>
      <button
        onClick={() => act('reject')}
        disabled={!!loading}
        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-950/50 hover:bg-red-900/60 disabled:opacity-50 text-red-400 border border-red-900/40 transition-colors"
      >
        {loading === 'reject' ? '...' : 'Reject'}
      </button>
    </div>
  )
}

export function VisibilityToggle({ id, type, isVisible }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(isVisible)

  async function handleToggle() {
    setLoading(true)
    setVisible((v) => !v)
    await fetch(`/api/${type === 'review' ? 'reviews' : 'articles'}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_visibility' }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={visible ? 'Hide from public' : 'Show on public'}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        visible ? 'bg-green-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          visible ? 'translate-x-4' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
