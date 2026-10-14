'use client'

// Yearly Weekends Until check-in opt-in — one email a year, on the same date.
// Same shape as WeeklyCheckinOptIn (a 44px trigger link → a label + 16px/44px
// field + Subscribe → an in-place confirmation, no layout jump), writing the
// 'yearly_weekends_checkin' enum value. Keeps its own server action — tool
// emails are a different list from the newsletter (continuity plan P11).

import { useId, useState, useTransition } from 'react'
import { LABELS } from '@/lib/labels'
import { subscribeToToolEmail } from '@/lib/dad-tools/email-actions'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'
import { CheckCircleIcon } from '@/components/icons'

interface Props {
  kidProfileId: string | null
  fallbackBirthdate: string  // YYYY-MM-DD
}

export default function YearlyCheckinOptIn({ kidProfileId, fallbackBirthdate }: Props) {
  const inputId = useId()
  const helpId = `${inputId}-help`
  const errorId = `${inputId}-error`
  const [showing, setShowing] = useState(false)
  const [email, setEmail]     = useState('')
  const [pending, startTransition] = useTransition()
  const [outcome, setOutcome]    = useState<'confirmed' | 'already' | null>(null)
  const [error, setError]          = useState<string | null>(null)
  const done = outcome !== null

  if (!showing) {
    return (
      <button
        type="button"
        onClick={() => setShowing(true)}
        className="inline-flex items-center min-h-[44px] text-sm font-semibold text-accent-text hover:underline underline-offset-2"
      >
        {LABELS.tools.emails.yearlyCheckin.optInCta}
      </button>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        const r = await subscribeToToolEmail({
          email: email.trim(),
          kind: 'yearly_weekends_checkin',
          kid_profile_id: kidProfileId ?? undefined,
          anchor_date: fallbackBirthdate || undefined,
        })
        if (!r.ok) { setError(r.error); return }
        setOutcome(r.already ? 'already' : 'confirmed')
      } catch {
        // A dropped connection used to leave the button idle and say nothing.
        setError('Couldn’t save that. Try again in a minute.')
      }
    })
  }

  return (
    <div>
      <p id={helpId} className="text-xs text-prose-faint mb-2">
        {LABELS.tools.emails.yearlyCheckin.optInHelp}
      </p>
      <div className="grid">
        <form
          onSubmit={handleSubmit}
          inert={done}
          aria-hidden={done || undefined}
          className={`[grid-area:1/1] flex flex-wrap gap-2 ${done ? 'invisible' : ''}`}
        >
          <label htmlFor={inputId} className="sr-only">{LABELS.newsletter.emailLabel}</label>
          <input
            id={inputId}
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }}
            placeholder={LABELS.newsletter.placeholder}
            aria-describedby={error ? `${helpId} ${errorId}` : helpId}
            aria-invalid={error ? true : undefined}
            className={fieldClass({ className: 'flex-1 min-w-0 basis-60' })}
          />
          <button type="submit" disabled={pending} className={buttonVariants({ className: 'basis-full sm:basis-auto' })}>
            {pending ? LABELS.newsletter.submitting : LABELS.newsletter.subscribe}
          </button>
        </form>
        {/* Same <p> for both outcomes so "already subscribed" doesn't shift the layout. */}
        <p role="status" className="[grid-area:1/1] self-center flex items-center gap-2 text-base font-semibold text-prose">
          {done && (
            <>
              <CheckCircleIcon className="w-5 h-5 shrink-0 text-success-ink" strokeWidth={2} />
              {outcome === 'already' ? LABELS.tools.emails.already : LABELS.tools.emails.yearlyCheckin.confirmed}
            </>
          )}
        </p>
      </div>
      {/* Always mounted, one line reserved — an error must not push the page down. */}
      <p id={errorId} role="alert" className="min-h-6 mt-1.5 text-sm font-semibold leading-6 text-danger-ink">
        {error}
      </p>
    </div>
  )
}
