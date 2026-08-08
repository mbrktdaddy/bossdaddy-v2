'use client'

// Who can reach you. Two switches, both writing the user's own profiles row via
// the self-update RLS policy — same path as MessageEmailToggle and the avatar/bio
// edits. Optimistic; reverts on failure.
//
// Both default to the permissive value in migration 140, deliberately. A privacy
// switch nobody knows to look for, defaulting to off, doesn't protect anyone — it
// just makes the feature look broken to the people who never found it.
//
// These govern being CONTACTED. Neither stops someone accepting an invite link
// they were handed, because accepting is already their own decision to make.

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  initialRequestsFrom: 'everyone' | 'nobody'
  initialDiscoverableByEmail: boolean
}

export default function ConnectionPrefs({
  initialRequestsFrom, initialDiscoverableByEmail,
}: Props) {
  const [openToRequests, setOpenToRequests] = useState(initialRequestsFrom === 'everyone')
  const [byEmail, setByEmail] = useState(initialDiscoverableByEmail)
  const [saving, setSaving] = useState(false)

  // Narrow to the two columns this component owns. A loose Record<string, unknown>
  // is rejected by the generated Update type (and rightly — it would let a typo
  // through to a column that isn't ours).
  type Patch =
    | { connection_requests_from: 'everyone' | 'nobody' }
    | { discoverable_by_email: boolean }

  async function save(patch: Patch, revert: () => void) {
    if (saving) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { revert(); setSaving(false); return }
    const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
    if (error) revert()
    setSaving(false)
  }

  return (
    <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Who can reach you</p>

      <Row
        label="Let people ask to connect"
        hint="Connecting is what lets two of you message each other and share a goal. Turn this off and nobody new can ask — the people already in your corner stay."
        checked={openToRequests}
        disabled={saving}
        onToggle={() => {
          const next = !openToRequests
          setOpenToRequests(next)
          save({ connection_requests_from: next ? 'everyone' : 'nobody' },
            () => setOpenToRequests(!next))
        }}
      />

      <div className="mt-5 pt-5 border-t border-soft">
        <Row
          label="Findable by my email address"
          hint="Someone who already knows your exact address can find you. Partial matches never work, and your address is never shown to anyone searching."
          checked={byEmail}
          disabled={saving}
          onToggle={() => {
            const next = !byEmail
            setByEmail(next)
            save({ discoverable_by_email: next }, () => setByEmail(!next))
          }}
        />
      </div>
    </div>
  )
}

function Row({
  label, hint, checked, disabled, onToggle,
}: {
  label: string; hint: string; checked: boolean; disabled: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-prose">{label}</p>
        <p className="text-xs text-prose-faint mt-0.5 leading-snug">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className="relative shrink-0 flex items-center min-h-[44px] disabled:opacity-50"
      >
        <span className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-raised border border-strong'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
        </span>
      </button>
    </div>
  )
}
