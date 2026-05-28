'use client'

// Weekly Check-in opt-in — quiet Sunday-evening nudge to capture a moment
// from the past week. Same shape as YearlyCheckinOptIn but writes the
// 'sunday_moments' enum value (internal name kept stable per the naming
// doctrine; public-facing label is "Weekly Check-in").
//
// Renders as a discreet button by default → reveals an email form on click
// → confirms inline on success. No modal, no router refresh — the kid page
// stays put so the dad can keep working.

import { useState, useTransition } from 'react'
import { LABELS } from '@/lib/labels'
import { subscribeToToolEmail } from '@/lib/dad-tools/email-actions'

interface Props {
  kidProfileId: string | null
  defaultEmail?: string
}

export default function WeeklyCheckinOptIn({ kidProfileId, defaultEmail }: Props) {
  const [showing, setShowing] = useState(false)
  const [email, setEmail]     = useState(defaultEmail ?? '')
  const [pending, startTransition] = useTransition()
  const [confirmed, setConfirmed]  = useState(false)
  const [error, setError]          = useState<string | null>(null)

  if (confirmed) {
    return (
      <p className="text-sm text-prose">
        {LABELS.tools.emails.weeklyCheckin.confirmed}
      </p>
    )
  }

  if (!showing) {
    return (
      <button
        type="button"
        onClick={() => setShowing(true)}
        className="text-sm text-accent hover:underline font-medium"
      >
        {LABELS.tools.emails.weeklyCheckin.optInCta}
      </button>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await subscribeToToolEmail({
        email: email.trim(),
        kind: 'sunday_moments',
        kid_profile_id: kidProfileId ?? undefined,
      })
      if (!r.ok) { setError(r.error); return }
      setConfirmed(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-xs text-prose-faint">
        {LABELS.tools.emails.weeklyCheckin.optInHelp}
      </p>
      <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="you@yourdomain.com"
          className="flex-1 min-w-0 px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={pending || !email}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
        >
          {pending ? 'Saving…' : 'Subscribe'}
        </button>
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </form>
  )
}
