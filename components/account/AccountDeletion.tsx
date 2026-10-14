'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SELF_DELETION_REASONS, OTHER_REASON } from '@/lib/moderation-reasons'
import { Card } from '@/components/ui/Card'
import { buttonVariants } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Field, fieldClass } from '@/components/ui/Field'

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
      <div role="alert" className="bg-danger-bg border border-danger-line rounded-xl p-6 mb-6">
        <Eyebrow className="mb-2 !text-danger-ink">Account scheduled for deletion</Eyebrow>
        <p className="text-sm text-prose-muted leading-relaxed mb-4">
          {deletionDate ? (
            <>Your account will be permanently deleted on <strong className="text-danger-ink">{deletionDate}</strong>. After that, all comments, votes, and subscriptions are wiped and the account can&apos;t be recovered.</>
          ) : (
            <>Your account is scheduled for deletion.</>
          )}
        </p>
        {error && <p className="text-sm font-medium text-danger-ink mb-3">{error}</p>}
        <button onClick={cancel} disabled={loading} className={buttonVariants()}>
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
    <Card tone="surface" className="p-6 mb-6 !border-danger-line">
      <Eyebrow className="mb-1 !text-danger-ink">Danger zone</Eyebrow>
      <p className="text-xs text-prose-muted mb-4">Permanent actions. Use with care.</p>

      {hasPublishedContent ? (
        <Card tone="sunken" className="p-4">
          <p className="text-sm text-prose-muted leading-relaxed">
            You&apos;ve published reviews or guides on Boss Daddy. Account deletion is a manual process for authors — please reach out to{' '}
            <a href="mailto:support@bossdaddylife.com?subject=Account%20deletion%20request" className="text-accent-text hover:text-prose">support@bossdaddylife.com</a>.
          </p>
        </Card>
      ) : !confirming ? (
        <button onClick={() => setConfirming(true)} className={buttonVariants({ variant: 'danger' })}>
          Delete my account
        </button>
      ) : (
        <div className="border border-danger-line bg-danger-bg rounded-xl p-4 space-y-4">
          <p className="text-sm text-prose leading-relaxed">
            This schedules your account for permanent deletion in <strong>{COOLDOWN_DAYS} days</strong>. You can cancel any time before then by signing back in. After {COOLDOWN_DAYS}{' '}days, comments, votes, and subscriptions are wiped and the account can&apos;t be recovered.
          </p>
          <div>
            <label htmlFor="delete-reason" className="block mb-1.5 text-sm font-semibold text-prose">
              Reason for leaving (optional, helps us improve)
            </label>
            <select id="delete-reason" value={reasonChoice} onChange={(e) => setReasonChoice(e.target.value)}
              className={fieldClass()}>
              <option value="">— Prefer not to say —</option>
              {SELF_DELETION_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {isOther && (
            <Field
              label="Tell us more"
              type="text" maxLength={200} value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="What's the reason?"
            />
          )}
          <Field
            label={<>Type <code className="text-danger-ink">DELETE</code> to confirm</>}
            type="text" value={confirmText} autoComplete="off"
            onChange={(e) => setConfirmText(e.target.value)}
          />
          {error && <p className="text-sm font-medium text-danger-ink">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={requestDelete} disabled={loading || confirmText !== 'DELETE'}
              className={buttonVariants({ variant: 'danger' })}>
              {loading ? 'Submitting…' : 'Schedule deletion'}
            </button>
            <button onClick={() => { setConfirming(false); setConfirmText(''); setError(null) }} disabled={loading}
              className={buttonVariants({ variant: 'outline' })}>
              Never mind
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
