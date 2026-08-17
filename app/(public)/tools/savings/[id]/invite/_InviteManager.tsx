'use client'

// Owner-side invite management: lists currently-pending invite links,
// generates new ones, copies them to the clipboard, and revokes them.
// Server Actions handle the writes; this just orchestrates UI state.

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvite, revokeInvite } from '@/lib/dad-tools/savings-actions'

interface MemberHit { id: string; username: string; displayName: string | null }

interface PendingInvite {
  id:         string
  /** What the shareable URL is built from. NOT `id` — see the list below. */
  token:      string
  createdAt:  string
  expiresAt:  string
  /** Member display name, else the address, else null for a bare link invite. */
  label:      string | null
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
  // Existing-member invite (relays to their in-app notifications).
  const [memberQ, setMemberQ] = useState('')
  const [memberHits, setMemberHits] = useState<MemberHit[]>([])
  const [invitingId, setInvitingId] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onMemberSearch(value: string) {
    setMemberQ(value)
    setSentTo(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) { setMemberHits([]); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/members/search?q=${encodeURIComponent(value.trim())}`)
      if (!res.ok) return
      const json = await res.json()
      setMemberHits(json.members ?? [])
    }, 250)
  }

  function inviteMember(m: MemberHit) {
    setError(null)
    setInvitingId(m.id)
    startTransition(async () => {
      const result = await createInvite({ goalId, inviteeUserId: m.id })
      setInvitingId(null)
      if (!result.ok) { setError(result.error); return }
      setSentTo(m.displayName || `@${m.username}`)
      setMemberQ(''); setMemberHits([])
      router.refresh()
    })
  }

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
          {/* Invite an existing member — relays straight to their notifications. */}
          <div className="relative">
            <label htmlFor="member-search" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Invite a member <span className="normal-case text-prose-faint">(they accept in their notifications)</span>
            </label>
            <input
              id="member-search"
              type="text"
              value={memberQ}
              onChange={(e) => onMemberSearch(e.target.value)}
              placeholder="Search by username or name…"
              className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
            {memberHits.length > 0 && (
              <div className="mt-2 border border-soft rounded-lg overflow-hidden divide-y divide-soft">
                {memberHits.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-surface-sunken">
                    <span className="min-w-0 text-sm text-prose truncate">
                      {m.displayName || `@${m.username}`} <span className="text-prose-faint text-xs">@{m.username}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => inviteMember(m)}
                      disabled={pending || invitingId === m.id}
                      className="shrink-0 px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg text-xs transition-colors"
                    >
                      {invitingId === m.id ? 'Inviting…' : 'Invite'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {sentTo && (
              <p className="text-xs text-success-ink mt-1.5">Invite sent to {sentTo} — they&apos;ll see it in their notifications.</p>
            )}
          </div>

          <div className="border-t border-soft pt-4">
            {/* The copy here said the email was "for your records only" and that
                "we don't auto-send invites yet". Both untrue — createInvite has
                sent SavingsInviteEmail for as long as this field has existed. It
                was telling the owner the opposite of what the button does, which
                on a page whose whole job is deciding who to let in is the wrong
                thing to be wrong about. */}
            <label htmlFor="invite-email" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
              Recipient email <span className="normal-case text-prose-faint">(optional — we&apos;ll send it)</span>
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
              Fill this in and we&apos;ll email them the invite. Leave it blank and
              you just get a link to share by text or DM. Inviting the same address
              again replaces the earlier link rather than adding a second one.
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
              ? `${window.location.origin}/tools/savings/invite/${inv.token}`
              : ''
            // This used to build the URL from `inv.id` — the row's primary key —
            // because the token wasn't among the columns the page selected. Every
            // link this list rendered was therefore dead, while the one shown
            // straight after generating worked, which made it look like links
            // expired immediately. The token is fetched now.
            return (
              <div
                key={inv.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft rounded-lg min-h-[44px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">
                    {inv.label ?? 'Link invite (no recipient)'}
                  </p>
                  <p className="text-[11px] text-prose-faint">
                    Expires {fmtRelative(inv.expiresAt)}
                  </p>
                  {/* The actual link, copyable. Previously an sr-only span holding
                      a dead URL, present only to satisfy the linter. */}
                  <p className="mt-1 break-all font-mono text-[10px] text-prose-faint">{url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(url, inv.id)}
                  className="shrink-0 px-3 py-1.5 bg-background border border-soft hover:border-strong text-prose-muted font-medium rounded-lg text-xs transition-colors"
                  aria-label={`Copy the invite link for ${inv.label ?? 'the shared link'}`}
                >
                  {copied === inv.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => onRevoke(inv.id)}
                  disabled={pending}
                  className="shrink-0 px-3 py-1.5 bg-background border border-soft hover:border-danger-line text-danger-ink font-medium rounded-lg text-xs transition-colors"
                  aria-label={`Revoke invite for ${inv.label ?? 'the shared link'}`}
                >
                  Revoke
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
