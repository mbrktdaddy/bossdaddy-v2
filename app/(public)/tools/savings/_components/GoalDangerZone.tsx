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
import { buttonVariants } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'

interface Props {
  goalId:    string
  status:    'active' | 'paused' | 'completed' | 'archived'
  goalName:  string
}

export default function GoalDangerZone({ goalId, status, goalName }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { prompt: askPrompt, dialog } = useConfirm()

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

  async function onDelete() {
    // Two-step confirmation: the prompt forces the user to type the goal name
    // to confirm. Stronger than a generic Yes/No since the action is
    // permanent + cascades all entries.
    const typed = await askPrompt({
      title: `Delete "${goalName}" forever?`,
      body: 'This removes the goal and EVERY contribution, withdrawal, and adjustment tied to it. This cannot be undone.',
      label: 'Type the goal name to confirm',
      confirmLabel: 'Delete permanently',
      danger: true,
    })
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
    <Card as="section" tone="chrome" className="p-6 space-y-4">
      <div>
        <Eyebrow>
          Danger zone
        </Eyebrow>
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
            className={buttonVariants({ variant: 'outline' })}
          >
            Restore from archive
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={onArchive}
            className={buttonVariants({ variant: 'outline' })}
          >
            Archive goal
          </button>
        )}

        <button
          type="button"
          disabled={pending}
          onClick={onDelete}
          className={buttonVariants({ variant: 'danger' })}
        >
          Delete permanently
        </button>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {dialog}
    </Card>
  )
}
