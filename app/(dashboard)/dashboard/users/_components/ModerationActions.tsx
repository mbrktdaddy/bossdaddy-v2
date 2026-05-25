'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_MODERATION_REASONS, OTHER_REASON } from '@/lib/moderation-reasons'

type Status = 'active' | 'suspended' | 'banned' | 'pending_deletion'

interface Props {
  userId: string
  username: string
  status: Status
  suspendedUntil: string | null
  reason: string | null
  isSelf: boolean
}

const STATUS_BADGE: Record<Status, { label: string; classes: string }> = {
  active:            { label: 'Active',     classes: 'bg-green-950/40 text-forest border-green-700/40' },
  suspended:         { label: 'Suspended',  classes: 'bg-amber-950/40 text-amber-300 border-amber-700/40' },
  banned:            { label: 'Banned',     classes: 'bg-red-950/40 text-red-300 border-red-700/40' },
  pending_deletion:  { label: 'Pending delete', classes: 'bg-zinc-950/60 text-zinc-400 border-zinc-800' },
}

const ACTIONS_BY_STATUS: Record<Status, Array<{ key: string; label: string; tone: 'safe' | 'warn' | 'danger' }>> = {
  active: [
    { key: 'suspend', label: 'Suspend (timed)', tone: 'warn' },
    { key: 'ban',     label: 'Ban (permanent)', tone: 'danger' },
    { key: 'delete',  label: 'Delete account',  tone: 'danger' },
  ],
  suspended: [
    { key: 'unsuspend', label: 'Lift suspension', tone: 'safe' },
    { key: 'ban',       label: 'Ban (permanent)', tone: 'danger' },
    { key: 'delete',    label: 'Delete account',  tone: 'danger' },
  ],
  banned: [
    { key: 'unban',  label: 'Unban (restore active)', tone: 'safe' },
    { key: 'delete', label: 'Delete account',         tone: 'danger' },
  ],
  pending_deletion: [
    { key: 'restore', label: 'Cancel deletion',    tone: 'safe' },
    { key: 'ban',     label: 'Ban instead',        tone: 'danger' },
  ],
}

export default function ModerationActions({ userId, username, status, suspendedUntil, reason, isSelf }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [durationDays, setDurationDays] = useState(7)
  const [reasonChoice, setReasonChoice] = useState<string>('')
  const [customReason, setCustomReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const badge = STATUS_BADGE[status]
  const isOther = reasonChoice === OTHER_REASON
  // Effective reason sent to the API: custom text if "Other" was picked,
  // otherwise the dropdown label, or undefined if nothing was chosen.
  const effectiveReason = isOther
    ? (customReason.trim() || undefined)
    : (reasonChoice || undefined)

  async function submit(action: string) {
    setLoading(true); setError(null)
    const res = await fetch('/api/admin/users/moderate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action,
        ...(action === 'suspend' ? { durationDays } : {}),
        ...(effectiveReason ? { reason: effectiveReason } : {}),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Action failed')
      setLoading(false)
      return
    }
    setLoading(false); setOpen(false); setPendingAction(null)
    setReasonChoice(''); setCustomReason('')
    router.refresh()
  }

  if (isSelf) {
    return (
      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${badge.classes}`}>
        {badge.label}
      </span>
    )
  }

  const actions = ACTIONS_BY_STATUS[status]

  return (
    <div className="flex items-center gap-2 relative">
      <span
        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${badge.classes}`}
        title={
          [
            reason ? `Reason: ${reason}` : null,
            suspendedUntil ? `Until: ${new Date(suspendedUntil).toLocaleString('en-US', { timeZone: 'UTC' })} UTC` : null,
          ].filter(Boolean).join('\n') || undefined
        }
      >
        {badge.label}
      </span>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-base text-prose-muted hover:bg-surface-raised hover:text-prose transition-colors"
        aria-label={`Moderation actions for @${username}`}
      >
        ⋯
      </button>

      {open && (
        <div role="menu" aria-label={`Moderation actions for @${username}`} className="absolute right-0 top-full mt-1 w-64 bg-surface-sunken border border-soft rounded-xl shadow-2xl z-50 p-1.5">
          {pendingAction == null ? (
            <>
              <p className="text-[10px] uppercase tracking-widest text-prose-faint px-3 pt-2 pb-1">
                Moderate @{username}
              </p>
              {actions.map(({ key, label, tone }) => (
                <button
                  key={key}
                  role="menuitem"
                  onClick={() => setPendingAction(key)}
                  className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    tone === 'danger' ? 'text-red-300 hover:bg-red-950/40'
                    : tone === 'warn' ? 'text-amber-300 hover:bg-amber-950/40'
                    : 'text-prose-muted hover:bg-surface hover:text-prose'
                  }`}
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            <div className="p-2 space-y-3">
              <p className="text-xs font-bold text-prose">
                {pendingAction === 'suspend' && `Suspend @${username}`}
                {pendingAction === 'ban' && `Ban @${username}?`}
                {pendingAction === 'delete' && `Delete @${username}?`}
                {pendingAction === 'unsuspend' && `Lift suspension on @${username}?`}
                {pendingAction === 'unban' && `Unban @${username}?`}
                {pendingAction === 'restore' && `Cancel deletion of @${username}?`}
              </p>

              {pendingAction === 'suspend' && (
                <label className="block text-xs text-prose-muted">
                  Duration (days)
                  <input
                    type="number" min={1} max={365}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full mt-1 px-2 py-1 bg-surface border border-strong rounded text-prose text-xs focus:outline-none focus:border-accent"
                  />
                </label>
              )}

              {(pendingAction === 'suspend' || pendingAction === 'ban' || pendingAction === 'delete') && (
                <div className="space-y-2">
                  <label className="block text-xs text-prose-muted">
                    Reason
                    <select
                      value={reasonChoice}
                      onChange={(e) => setReasonChoice(e.target.value)}
                      className="w-full mt-1 px-2 py-1 bg-surface border border-strong rounded text-prose text-xs focus:outline-none focus:border-accent"
                    >
                      <option value="">— Select a reason —</option>
                      {ADMIN_MODERATION_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {isOther && (
                    <label className="block text-xs text-prose-muted">
                      Specify
                      <input
                        type="text" maxLength={200}
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="Describe the violation"
                        className="w-full mt-1 px-2 py-1 bg-surface border border-strong rounded text-prose text-xs focus:outline-none focus:border-accent"
                      />
                    </label>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-300">{error}</p>}

              <div className="flex gap-2">
                <button
                  onClick={() => submit(pendingAction)}
                  disabled={loading}
                  className="flex-1 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors"
                >
                  {loading ? 'Working…' : 'Confirm'}
                </button>
                <button
                  onClick={() => { setPendingAction(null); setReasonChoice(''); setCustomReason('') }}
                  disabled={loading}
                  className="px-3 py-1.5 bg-surface-raised hover:bg-zinc-700 text-prose-muted text-xs font-semibold rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
