'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { buttonVariants } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { removeParticipant } from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId: string
  userId: string
  name:   string
}

export default function RemoveParticipantButton({ goalId, userId, name }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { confirm: askConfirm, dialog } = useConfirm()

  async function onRemove() {
    const ok = await askConfirm({
      title: `Remove ${name} from this goal?`,
      body: 'Their contribution history stays in the log. They can be re-invited later.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await removeParticipant({ goalId, userId })
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onRemove}
        disabled={pending}
        className={buttonVariants({ variant: 'danger', size: 'md' })}
        aria-label={`Remove ${name}`}
      >
        Remove
      </button>
      {error && (
        <p className="text-[10px] text-danger-ink max-w-[160px]">{error}</p>
      )}
      {dialog}
    </div>
  )
}
