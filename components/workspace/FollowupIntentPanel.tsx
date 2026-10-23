'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Segmented'
import { Field } from '@/components/ui/Field'
import { buttonVariants } from '@/components/ui/Button'
import { FOLLOWUP_INTENT_PRESETS, intentFromPreset, type FollowupIntentPreset } from '@/lib/content/freshness'

// The author's revisit plan, set while the context is fresh (content pipeline
// plan Phase 4; memory `project_premeditated_followup_scheduling`). Two facts
// ride the workspace payload: `followup_intent_at` (the plan) and
// `last_verified_at` ("I checked, it still stands"). The weekly sweep turns a
// passed intent into a dashboard flag; verifying after the date clears it.
// Dashboard only — no email.

type Mode = 'none' | FollowupIntentPreset | 'custom'

interface Props {
  contentType: 'review' | 'guide'
  intentAt: string | null
  onChangeIntent: (iso: string | null) => void
  lastVerifiedAt: string | null
  onMarkVerified: () => void
  disabled?: boolean
}

const DAY_MS = 86_400_000

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** ISO at midday UTC for a `YYYY-MM-DD` input value, so the date never slips a day in any zone. */
function isoFromDateInput(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return `${v}T12:00:00.000Z`
}

export function FollowupIntentPanel({ contentType, intentAt, onChangeIntent, lastVerifiedAt, onMarkVerified, disabled }: Props) {
  // Mode is a UI memory, not derived: a preset picked last month doesn't
  // re-match today's "30 days", and the author only needs to see the date.
  const [mode, setMode] = useState<Mode>(intentAt ? 'custom' : 'none')
  // Snapshot once — a day counter doesn't need to tick, and reading Date.now()
  // in render is what the purity lint is for.
  const [now] = useState(() => Date.now())
  const [justVerified, setJustVerified] = useState(false)

  const noun = contentType === 'review' ? 'follow-up' : 'refresh'
  const daysUntil = intentAt ? Math.round((Date.parse(intentAt) - now) / DAY_MS) : null

  const options: { value: Mode; label: string }[] = [
    { value: 'none', label: 'None' },
    ...FOLLOWUP_INTENT_PRESETS.map((p) => ({ value: p.value as Mode, label: p.label })),
    { value: 'custom', label: 'Pick a date' },
  ]

  function pick(next: Mode) {
    setMode(next)
    if (next === 'none') onChangeIntent(null)
    else if (next !== 'custom') onChangeIntent(intentFromPreset(next))
    // 'custom' keeps whatever is set until the date field changes it.
  }

  return (
    <Card tone="faint" className="p-4">
      <p className="text-xs text-prose-faint font-medium uppercase tracking-widest mb-2">
        Revisit plan
      </p>
      <p className="text-sm text-prose-muted mb-3">
        {intentAt && daysUntil != null
          ? daysUntil < 0
            ? `${noun[0].toUpperCase()}${noun.slice(1)} was due ${fmt(intentAt)} — ${-daysUntil} day${-daysUntil === 1 ? '' : 's'} ago.`
            : daysUntil === 0
              ? `${noun[0].toUpperCase()}${noun.slice(1)} due today (${fmt(intentAt)}).`
              : `${noun[0].toUpperCase()}${noun.slice(1)} due ${fmt(intentAt)} — in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`
          : `No ${noun} planned. Set one now while the context is fresh; the dashboard reminds you when it's due.`}
      </p>

      <Segmented<Mode> label={`${noun} timing`} value={mode} options={options} onChange={pick} />

      {mode === 'custom' && (
        <Field
          type="date"
          label="Revisit on"
          className="mt-3"
          controlClassName="max-w-xs"
          value={intentAt ? intentAt.slice(0, 10) : ''}
          disabled={disabled}
          onChange={(e) => onChangeIntent(isoFromDateInput(e.target.value))}
        />
      )}

      <div className="mt-4 pt-3 border-t border-soft flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-prose-faint">
          {justVerified
            ? 'Marked verified — saves with the next autosave.'
            : lastVerifiedAt
              ? `Last verified ${fmt(lastVerifiedAt)}.`
              : 'Never verified since publishing.'}
        </p>
        <button
          type="button"
          disabled={disabled || justVerified}
          onClick={() => { onMarkVerified(); setJustVerified(true) }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Still stands — verified today
        </button>
      </div>
      <p className="text-xs text-prose-faint mt-2">
        Verifying after the planned date clears the reminder. Counted from today.
      </p>
    </Card>
  )
}
