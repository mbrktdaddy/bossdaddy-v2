'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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

  function onRemove() {
    if (!window.confirm(`Remove ${name} from this goal?\n\nTheir contribution history stays in the log. They can be re-invited later.`)) return
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
        className="px-3 py-1.5 bg-background border border-soft hover:border-danger-line disabled:opacity-50 text-danger-ink font-medium rounded-lg text-xs transition-colors"
        aria-label={`Remove ${name}`}
      >
        Remove
      </button>
      {error && (
        <p className="text-[10px] text-danger-ink max-w-[160px]">{error}</p>
      )}
    </div>
  )
}
