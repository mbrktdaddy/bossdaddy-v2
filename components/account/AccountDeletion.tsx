'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SELF_DELETION_REASONS, OTHER_REASON } from '@/lib/moderation-reasons'

interface Props {
  accountStatus: string
  deletionDate: string | null
  hasPublishedContent: boolean
}

const COOLDOWN_DAYS = 30

export default function AccountDeletion({ accountStatus, deletionDate, hasPublishedContent }: Props) {
  const [reasonChoice, setReasonChoice] = useState('')
  const [customReason, setCustomReason] = useState('')
  const isOther = reasonChoice === OTHER_REASON
  const effectiveReason = isOther ? (customReason.trim() || undefined) : (reasonChoice || undefined)
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (accountStatus === 'pending_deletion') {
    async function cancel() {
      setLoading(true); setError(null)
      const res = await fetch('/api/account/cancel-deletion', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error ?? 'Could not cancel deletion.'); setLoading(false); return }
      setLoading(false)
      router.refresh()
    }
    return (
      <div className="bg-red-50 border border-red-300 rounded-xl p-6 mb-6">
        <p className="text-xs text-red-700 uppercase tracking-widest font-semibold mb-2">Account scheduled for deletion</p>
        <p className="text-sm text-prose-muted leading-relaxed mb-4">
          {deletionDate ? (
            <>Your account will be permanently deleted on <strong className="text-red-700">{deletionDate}</strong>. After that, all comments, votes, and subscriptions are wiped and the account can&apos;t be recovered.</>
          ) : (
            <>Your account is scheduled for deletion.</>
          )}
        </p>
        {error && <p className="text-sm text-red-700 mb-3">{error}</p>}
        <button onClick={cancel} disabled={loading}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
          {loading ? 'Canceling…' : 'Cancel deletion — keep my account'}
        </button>
      </div>
    )
  }

  async function requestDelete() {
    setLoading(true); setError(null)
    const res = await fetch('/api/account/delete-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(effectiveReason ? { reason: effectiveReason } : {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setError(json.error ?? 'Could not request deletion.'); setLoading(false); return }
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
      <p className="text-xs text-red-700 uppercase tracking-widest font-semibold mb-1">Danger zone</p>
      <p className="text-xs text-prose-faint mb-4">Permanent actions. Use with care.</p>

      {hasPublishedContent ? (
        <div className="border border-soft rounded-xl p-4 bg-surface-sunken">
          <p className="text-sm text-prose-muted leading-relaxed">
            You&apos;ve published reviews or guides on Boss Daddy. Account deletion is a manual process for authors — please reach out to{' '}
            <a href="mailto:boss@bossdaddylife.com?subject=Account%20deletion%20request" className="text-accent-text-soft hover:text-accent">boss@bossdaddylife.com</a>.
          </p>
        </div>
      ) : !confirming ? (
        <button onClick={() => setConfirming(true)}
          className="px-5 py-2.5 border border-red-300 hover:bg-red-50 hover:border-red-700 text-red-700 text-sm font-semibold rounded-xl transition-colors">
          Delete my account
        </button>
      ) : (
        <div className="border border-red-300 bg-red-50 rounded-xl p-4 space-y-3">
          <p className="text-sm text-prose leading-relaxed">
            This schedules your account for permanent deletion in <strong>{COOLDOWN_DAYS} days</strong>. You can cancel any time before then by signing back in. After {COOLDOWN_DAYS} days, comments, votes, and subscriptions are wiped and the account can&apos;t be recovered.
          </p>
          <label className="block text-xs text-prose-muted">
            Reason for leaving (optional, helps us improve)
            <select value={reasonChoice} onChange={(e) => setReasonChoice(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-surface border border-strong rounded text-prose text-sm focus:outline-none focus:border-accent">
              <option value="">— Prefer not to say —</option>
              {SELF_DELETION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          {isOther && (
            <label className="block text-xs text-prose-muted">
              Tell us more
              <input type="text" maxLength={200} value={customReason} onChange={(e) => setCustomReason(e.target.value)}
                placeholder="What's the reason?"
                className="w-full mt-1 px-3 py-2 bg-surface border border-strong rounded text-prose text-sm focus:outline-none focus:border-accent"
              />
            </label>
          )}
          <label className="block text-xs text-prose-muted">
            Type <code className="text-red-700">DELETE</code> to confirm:
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off"
              className="w-full mt-1 px-3 py-2 bg-surface border border-red-300 rounded text-prose text-sm focus:outline-none focus:border-red-500"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button onClick={requestDelete} disabled={loading || confirmText !== 'DELETE'}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">
              {loading ? 'Submitting…' : 'Schedule deletion'}
            </button>
            <button onClick={() => { setConfirming(false); setConfirmText(''); setError(null) }} disabled={loading}
              className="px-4 py-2 bg-surface-raised hover:bg-zinc-700 text-prose-muted text-sm font-semibold rounded-lg transition-colors">
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
