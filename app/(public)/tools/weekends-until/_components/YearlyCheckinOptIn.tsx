'use client'

import { useState, useTransition } from 'react'
import { subscribeToToolEmail } from '@/lib/dad-tools/email-actions'
import { LABELS } from '@/lib/labels'
import { buttonVariants } from '@/components/ui/Button'

interface Props {
  kidProfileId: string | null
  fallbackBirthdate: string  // YYYY-MM-DD
}

export default function YearlyCheckinOptIn({ kidProfileId, fallbackBirthdate }: Props) {
  const [showing, setShowing] = useState(false)
  const [email, setEmail]     = useState('')
  const [pending, startTransition] = useTransition()
  const [outcome, setOutcome]    = useState<'confirmed' | 'already' | null>(null)
  const [error, setError]          = useState<string | null>(null)

  if (outcome) {
    // Same <p> for both outcomes so "already subscribed" doesn't shift the layout.
    return (
      <p className="text-sm text-prose">
        {outcome === 'already' ? LABELS.tools.emails.already : LABELS.tools.emails.yearlyCheckin.confirmed}
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
        {LABELS.tools.emails.yearlyCheckin.optInCta}
      </button>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const r = await subscribeToToolEmail({
        email: email.trim(),
        kind: 'yearly_weekends_checkin',
        kid_profile_id: kidProfileId ?? undefined,
        anchor_date: fallbackBirthdate || undefined,
      })
      if (!r.ok) { setError(r.error); return }
      setOutcome(r.already ? 'already' : 'confirmed')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-xs text-prose-faint">
        {LABELS.tools.emails.yearlyCheckin.optInHelp}
      </p>
      <div className="flex items-stretch gap-2 flex-wrap sm:flex-nowrap">
        <input
          autoComplete="email"
          type="email"
          required
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(null) }}
          placeholder="you@yourdomain.com"
          className="flex-1 min-w-0 px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-base min-h-[44px] placeholder:text-prose-faint focus:outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={pending || !email}
          className={buttonVariants({ className: 'whitespace-nowrap' })}
        >
          {pending ? 'Saving…' : 'Subscribe'}
        </button>
      </div>
      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </form>
  )
}
