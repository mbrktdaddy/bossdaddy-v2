'use client'

// Destructive actions on a savings goal — archive (soft, preserves history)
// and delete (hard, cascades all entries). Lives at the bottom of the edit
// page where users expect destructive controls. Mirrors the AccountDeletion
// pattern from /dashboard/profile.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveGoal,
  resumeGoal,
  deleteGoal,
} from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId:    string
  status:    'active' | 'paused' | 'completed' | 'archived'
  goalName:  string
}

export default function GoalDangerZone({ goalId, status, goalName }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function onArchive() {
    setError(null)
    startTransition(async () => {
      const result = await archiveGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.push('/tools/savings')
    })
  }

  function onUnarchive() {
    setError(null)
    startTransition(async () => {
      const result = await resumeGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  function onDelete() {
    // Two-step confirmation: the prompt forces the user to type the goal name
    // to confirm. Stronger than a generic Yes/No since the action is
    // permanent + cascades all entries.
    const typed = window.prompt(
      `Delete "${goalName}" forever?\n\nThis removes the goal and EVERY contribution, withdrawal, and adjustment tied to it. This cannot be undone.\n\nType the goal name to confirm:`,
    )
    if (typed === null) return
    if (typed.trim() !== goalName.trim()) {
      setError('Goal name didn\'t match — delete cancelled.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.push('/tools/savings')
    })
  }

  const isArchived = status === 'archived'

  return (
    <section className="bg-surface border border-soft rounded-xl p-6 space-y-4">
      <div>
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          Danger zone
        </p>
        <p className="text-xs text-prose-faint mt-1">
          Archive hides the goal from your list but keeps its history. Delete
          removes everything permanently.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isArchived ? (
          <button
            type="button"
            disabled={pending}
            onClick={onUnarchive}
            className="px-4 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/50 disabled:opacity-50 text-prose-muted hover:text-prose font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
          >
            Restore from archive
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onArchive}
            className="px-4 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/50 disabled:opacity-50 text-prose-muted hover:text-prose font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
          >
            Archive goal
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className="px-4 py-2.5 bg-danger-bg border border-danger-line hover:border-danger-ink disabled:opacity-50 text-danger-ink font-semibold rounded-lg text-sm transition-colors min-h-[44px]"
        >
          Delete permanently
        </button>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
    </section>
  )
}
