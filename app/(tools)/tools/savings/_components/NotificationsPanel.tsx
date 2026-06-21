'use client'

// Reminders + notifications controls on the goal detail page. Two distinct
// levers, deliberately separated:
//   1. (owner only) Goal-level reminders on/off — controls whether THIS GOAL
//      sends reminder/nudge emails to anyone. Maps to savings_goals.reminder_enabled.
//   2. (everyone)   "Your emails" mute — silences this goal's emails for the
//      CURRENT participant only, without leaving the goal. Maps to
//      savings_goal_participants.muted.
//
// Both crons (savings-reminders, savings-spouse-nudge) honor both flags.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateGoal, setParticipantMute } from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId:                 string
  isOwner:                boolean
  initialReminderEnabled: boolean
  initialMuted:           boolean
}

export default function NotificationsPanel({
  goalId, isOwner, initialReminderEnabled, initialMuted,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderEnabled)
  const [muted, setMuted] = useState(initialMuted)
  const [error, setError] = useState<string | null>(null)

  function toggleGoalReminders() {
    const next = !reminderEnabled
    setError(null)
    setReminderEnabled(next) // optimistic
    startTransition(async () => {
      const result = await updateGoal({ id: goalId, reminder_enabled: next })
      if (!result.ok) { setReminderEnabled(!next); setError(result.error); return }
      router.refresh()
    })
  }

  function toggleMyMute() {
    const next = !muted
    setError(null)
    setMuted(next) // optimistic
    startTransition(async () => {
      const result = await setParticipantMute({ goalId, muted: next })
      if (!result.ok) { setMuted(!next); setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <section className="bg-surface border border-soft rounded-xl p-5 space-y-4">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
        Reminders &amp; notifications
      </p>

      {isOwner && (
        <Row
          title="Reminders for this goal"
          desc={reminderEnabled
            ? 'On — everyone on this goal gets reminder emails on schedule.'
            : 'Off — no one on this goal receives reminder emails.'}
          on={reminderEnabled}
          onLabel="On"
          offLabel="Off"
          disabled={pending}
          onToggle={toggleGoalReminders}
        />
      )}

      <Row
        title="Your emails for this goal"
        desc={muted
          ? 'Muted — you won’t get reminder or nudge emails for this goal.'
          : 'On — you’ll get this goal’s reminder and nudge emails.'}
        on={!muted}
        onLabel="On"
        offLabel="Muted"
        disabled={pending}
        onToggle={toggleMyMute}
      />

      {!isOwner && (
        <p className="text-[11px] text-prose-faint leading-snug">
          Muting only affects your own emails. The goal owner controls whether
          this goal sends reminders at all.
        </p>
      )}

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </section>
  )
}

function Row({
  title, desc, on, onLabel, offLabel, disabled, onToggle,
}: {
  title: string; desc: string; on: boolean
  onLabel: string; offLabel: string; disabled: boolean; onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-prose">{title}</p>
        <p className="text-xs text-prose-faint leading-snug mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={`shrink-0 min-h-[44px] px-4 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${
          on
            ? 'bg-accent border-accent text-white hover:bg-accent-hover'
            : 'bg-surface-sunken border-soft text-prose-muted hover:text-prose'
        }`}
      >
        {on ? onLabel : offLabel}
      </button>
    </div>
  )
}
