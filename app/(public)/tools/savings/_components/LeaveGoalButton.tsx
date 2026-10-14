'use client'

// Visible only to non-owner participants on a goal's detail page.
// Calls removeParticipant({ goalId, userId: self }) — the Server Action
// already permits self-removal for non-owners. After leaving, the user
// loses RLS access to the goal, so we redirect them to the index.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { removeParticipant } from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId:    string
  userId:    string
  goalName:  string
}

export default function LeaveGoalButton({ goalId, userId, goalName }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { confirm, dialog } = useConfirm()

  async function onLeave() {
    const ok = await confirm({
      title: `Leave "${goalName}"?`,
      body: "Your past contributions stay in the goal's history. You'll lose access to view it. If you change your mind, the owner can re-invite you.",
      confirmLabel: 'Leave goal',
      danger: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await removeParticipant({ goalId, userId })
      if (!result.ok) { setError(result.error); return }
      router.push('/tools/savings')
    })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onLeave}
        disabled={pending}
        className={buttonVariants({ variant: 'danger' })}
      >
        Leave this goal
      </button>
      {error && (
        <p className="text-xs text-danger-ink">{error}</p>
      )}
      {dialog}
    </div>
  )
}
