'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  /** 'active' | 'suspended' | 'banned' | 'pending_deletion' */
  accountStatus: string
  /** Pre-formatted deletion date string (e.g. "May 15, 2026"), or null. */
  deletionDate: string | null
  /** True if the user has any published reviews/guides — blocks self-delete. */
  hasPublishedContent: boolean
}

const COOLDOWN_DAYS = 30

export default function AccountDeletion({ accountStatus, deletionDate, hasPublishedContent }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // -------- pending_deletion state --------
  if (accountStatus === 'pending_deletion') {
    async function cancel() {
      setLoading(true); setError(null)
      const res = await fetch('/api/account/cancel-deletion', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Could not cancel deletion.')
        setLoading(false)
        return
      }
      setLoading(false)
      router.refresh()
    }

    return (
      <div className="bg-red-950/30 border border-red-900/40 rounded-2xl p-6 mb-6">
        <p className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-2">
          Account scheduled for deletion
        </p>
        <p className="text-sm text-gray-300 leading-relaxed mb-4">
          {deletionDate ? (
            <>
              Your account will be permanently deleted on{' '}
              <strong className="text-red-400">{deletionDate}</strong>. After that, all comments,
              votes, and subscriptions are wiped and the account can&apos;t be recovered.
            </>
          ) : (
            <>Your account is scheduled for deletion.</>
          )}
        </p>
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <button
          onClick={cancel}
          disabled={loading}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {loading ? 'Canceling…' : 'Cancel deletion — keep my account'}
        </button>
      </div>
    )
  }

  // -------- active state — danger zone with delete option --------
  async function requestDelete() {
    setLoading(true); setError(null)
    const res = await fetch('/api/account/delete-request', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Could not request deletion.')
      setLoading(false)
      return
    }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <p className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-1">Danger zone</p>
      <p className="text-xs text-gray-600 mb-4">Permanent actions. Use with care.</p>

      {hasPublishedContent ? (
        <div className="border border-gray-800 rounded-xl p-4 bg-gray-950">
          <p className="text-sm text-gray-400 leading-relaxed">
            You&apos;ve published reviews or guides on Boss Daddy. Account deletion is a manual
            process for authors — please reach out to{' '}
            <a href="mailto:boss@bossdaddylife.com?subject=Account%20deletion%20request"
               className="text-orange-400 hover:text-orange-300">boss@bossdaddylife.com</a>.
          </p>
        </div>
      ) : !confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="px-5 py-2.5 border border-red-900/60 hover:bg-red-950/40 hover:border-red-700 text-red-400 hover:text-red-300 text-sm font-semibold rounded-xl transition-colors"
        >
          Delete my account
        </button>
      ) : (
        <div className="border border-red-900/40 bg-red-950/20 rounded-xl p-4 space-y-3">
          <p className="text-sm text-gray-200 leading-relaxed">
            This schedules your account for permanent deletion in <strong>{COOLDOWN_DAYS} days</strong>.
            You can cancel any time before then by signing back in. After {COOLDOWN_DAYS} days,
            comments, votes, and subscriptions are wiped and the account can&apos;t be recovered.
          </p>
          <label className="block text-xs text-gray-400">
            Type <code className="text-red-400">DELETE</code> to confirm:
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full mt-1 px-3 py-2 bg-gray-900 border border-red-900/60 rounded text-white text-sm focus:outline-none focus:border-red-500"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={requestDelete}
              disabled={loading || confirmText !== 'DELETE'}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {loading ? 'Submitting…' : 'Schedule deletion'}
            </button>
            <button
              onClick={() => { setConfirming(false); setConfirmText(''); setError(null) }}
              disabled={loading}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-semibold rounded-lg transition-colors"
            >
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
