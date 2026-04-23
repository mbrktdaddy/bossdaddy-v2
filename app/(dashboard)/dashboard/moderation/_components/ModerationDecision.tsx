'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  id: string
  contentType: 'articles' | 'reviews'
}

export function ModerationDecision({ id, contentType }: Props) {
  const router = useRouter()
  const [pendingAction, setPendingAction] = useState<'reject' | 'request_edits' | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleModerate(action: 'approve' | 'reject' | 'request_edits') {
    setSubmitting(true)
    setActionError(null)
    const res = await fetch(`/api/${contentType}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejection_reason: reason }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setActionError(json.error ?? 'Action failed. Please try again.')
      setSubmitting(false)
      return
    }
    router.push('/dashboard/moderation')
    router.refresh()
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      {actionError && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3 mb-4">
          {actionError}
        </p>
      )}
      <p className="text-sm font-semibold text-gray-300 mb-4">Moderation Decision</p>

      {!pendingAction ? (
        <div className="flex gap-3">
          <button
            onClick={() => handleModerate('approve')}
            disabled={submitting}
            className="flex-1 py-3 bg-green-800 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            ✓ Approve
          </button>
          <button
            onClick={() => setPendingAction('request_edits')}
            disabled={submitting}
            className="flex-1 py-3 bg-yellow-900/60 hover:bg-yellow-900 disabled:opacity-50 text-yellow-300 text-sm font-semibold rounded-xl transition-colors border border-yellow-900/40"
          >
            ↩ Request Edits
          </button>
          <button
            onClick={() => setPendingAction('reject')}
            disabled={submitting}
            className="flex-1 py-3 bg-red-950/60 hover:bg-red-900/60 disabled:opacity-50 text-red-400 text-sm font-semibold rounded-xl transition-colors border border-red-900/40"
          >
            ✗ Reject
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            {pendingAction === 'request_edits'
              ? 'What changes does the author need to make?'
              : 'Why is this being rejected? (shown to author)'}
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Be specific and helpful..."
            className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none h-24"
            autoFocus
          />
          <div className="flex gap-3">
            <button
              onClick={() => handleModerate(pendingAction)}
              disabled={submitting || !reason.trim()}
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {submitting ? 'Sending...' : `Confirm ${pendingAction === 'request_edits' ? 'Request' : 'Rejection'}`}
            </button>
            <button
              onClick={() => { setPendingAction(null); setReason('') }}
              disabled={submitting}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
