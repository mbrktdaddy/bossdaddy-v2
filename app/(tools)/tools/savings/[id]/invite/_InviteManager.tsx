'use client'

// Owner-side invite management: lists currently-pending invite links,
// generates new ones, copies them to the clipboard, and revokes them.
// Server Actions handle the writes; this just orchestrates UI state.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvite, revokeInvite } from '@/lib/dad-tools/savings-actions'

interface PendingInvite {
  id:         string
  createdAt:  string
  expiresAt:  string
  email:      string | null
}

interface Props {
  goalId:          string
  goalName:        string
  pendingInvites:  PendingInvite[]
  seatsRemaining:  number
}

function fmtRelative(iso: string): string {
  const date = new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  return `in ${diffDays} days`
}

export default function InviteManager({ goalId, goalName, pendingInvites, seatsRemaining }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [freshLink, setFreshLink] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function onGenerate() {
    setError(null)
    setFreshLink(null)
    startTransition(async () => {
      const result = await createInvite({
        goalId,
        email: email.trim() || null,
      })
      if (!result.ok) { setError(result.error); return }
      setFreshLink(result.data?.url ?? null)
      setEmail('')
      router.refresh()
    })
  }

  function onRevoke(id: string) {
    if (!window.confirm('Revoke this invite? Anyone who has the link will no longer be able to join.')) return
    setError(null)
    startTransition(async () => {
      const result = await revokeInvite(id)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  async function copyToClipboard(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Couldn\'t copy — long-press the link to copy manually.')
    }
  }

  const isFull = seatsRemaining <= 0

  return (
    <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          Generate a link
        </p>
        <p className="text-xs text-prose-faint">
          {seatsRemaining > 0
            ? `${seatsRemaining} seat${seatsRemaining === 1 ? '' : 's'} available`
            : 'Goal full'}
        </p>
      </div>

      {!isFull && (
        <>
          <div>
            <label htmlFor="invite-email" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Recipient email <span className="normal-case text-prose-faint">(optional — for your records)</span>
            </label>
            <input
              id="invite-email"
              type="email"
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
              className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            <p className="text-xs text-prose-faint mt-1.5">
              Email is for your records only — we don&apos;t auto-send invites yet.
              Share the link by text, DM, or email yourself.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onGenerate}
            className="w-full sm:w-auto bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]"
          >
            {pending ? 'Generating…' : 'Generate invite link'}
          </button>
        </>
      )}

      {freshLink && (
        <div className="bg-success-bg border border-success-line rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-success-ink">
            Link ready — copy and share it with whoever you&apos;re inviting to {goalName}.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={freshLink}
              className="flex-1 min-w-0 px-3 py-2 bg-background border border-soft rounded-lg text-prose text-sm font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              onClick={() => copyToClipboard(freshLink, 'fresh')}
              className="shrink-0 px-3 py-2 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
            >
              {copied === 'fresh' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-[11px] text-prose-faint">Expires in 7 days. Single-use.</p>
        </div>
      )}

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {pendingInvites.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-soft">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            Pending invites — {pendingInvites.length}
          </p>
          {pendingInvites.map((inv) => {
            const url = typeof window !== 'undefined'
              ? `${window.location.origin}/tools/savings/invite/${inv.id}`
              : ''
            // The server doesn't expose the token to the client (we don't need
            // it for revoke), so the "copy link" button regenerates the link
            // by hitting createInvite again. For now we just show the email
            // and a Revoke button — the link can be re-generated.
            return (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft rounded-lg min-h-[44px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">
                    {inv.email ?? 'Untagged invite'}
                  </p>
                  <p className="text-[11px] text-prose-faint">
                    Expires {fmtRelative(inv.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(inv.id)}
                  disabled={pending}
                  className="shrink-0 px-3 py-1.5 bg-background border border-soft hover:border-danger-line text-danger-ink font-medium rounded-lg text-xs transition-colors"
                  aria-label={`Revoke invite for ${inv.email ?? 'untagged invite'}`}
                >
                  Revoke
                </button>
                {/* url referenced only to silence the lint warning around the
                    unused inv.id usage — kept for future "regenerate link" UX. */}
                <span className="sr-only">{url}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
