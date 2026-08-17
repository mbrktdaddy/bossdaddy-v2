'use client'

// Non-destructive Pause / Resume toggle for the goal owner. Lives in the
// detail-page header next to Edit/Invite. Pausing keeps the goal in the list
// (unlike Archive) but stops reminder crons, which only target status='active'.
// Restoring a paused goal flips it back to 'active'.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { pauseGoal, resumeGoal } from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId: string
  status: 'active' | 'paused' | 'completed' | 'archived'
}

export default function GoalStatusButton({ goalId, status }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Archived goals are restored via the danger zone; don't offer pause there.
  if (status === 'archived') return null

  const isPaused = status === 'paused'

  function onToggle() {
    setError(null)
    startTransition(async () => {
      const result = isPaused ? await resumeGoal(goalId) : await pauseGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={onToggle}
        className="text-sm text-prose-faint hover:text-prose-muted transition-colors px-3 py-1.5 border border-soft rounded-lg disabled:opacity-50 min-h-[44px]"
      >
        {isPaused ? 'Resume' : 'Pause'}
      </button>
      {error && <span className="text-[11px] text-danger-ink">{error}</span>}
    </div>
  )
}
