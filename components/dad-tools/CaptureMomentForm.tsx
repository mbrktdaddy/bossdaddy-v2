'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addMoment } from '@/lib/dad-tools/moment-actions'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

interface Props {
  kidProfileId: string
  kidName?: string | null
  defaultKind?: 'general' | 'weekend'
  defaultDate?: string         // YYYY-MM-DD; otherwise today
  onSuccess?: () => void
  onCancel?: () => void
  autoFocus?: boolean
}

export default function CaptureMomentForm({
  kidProfileId,
  kidName,
  defaultKind = 'general',
  defaultDate,
  onSuccess,
  onCancel,
  autoFocus = false,
}: Props) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [response,    setResponse]    = useState('')
  const [occurredOn,  setOccurredOn]  = useState(defaultDate ?? today)
  const [error,       setError]       = useState<string | null>(null)
  const [pending, startTransition]    = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimmed = response.trim()
    if (trimmed.length === 0) {
      setError('Tell us what happened')
      return
    }

    startTransition(async () => {
      const result = await addMoment({
        kid_profile_id: kidProfileId,
        response: trimmed,
        moment_kind: defaultKind,
        occurred_on: occurredOn || null,
      })
      if (!result.ok) { setError(result.error); return }
      setResponse('')
      router.refresh()
      onSuccess?.()
    })
  }

  const placeholder = kidName?.trim()
    ? `What happened with ${kidName.trim()}?`
    : 'What happened?'

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <Field
        as="textarea"
        label={placeholder}
        hideLabel
        value={response}
        rows={3}
        maxLength={2000}
        autoFocus={autoFocus}
        onChange={(e) => { setResponse(e.target.value); setError(null) }}
        placeholder={placeholder}
        controlClassName="resize-none"
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Field
          type="date"
          label="When did this happen?"
          hideLabel
          value={occurredOn}
          max={today}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="w-auto"
        />

        <div className="flex-1" />

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={buttonVariants({ variant: "ghost" })}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending || response.trim().length === 0}
          className={buttonVariants()}
        >
          {pending ? 'Capturing…' : 'Capture'}
        </button>
      </div>

      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </form>
  )
}
