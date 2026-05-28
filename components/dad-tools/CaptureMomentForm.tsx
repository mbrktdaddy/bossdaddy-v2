'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addMoment } from '@/lib/dad-tools/moment-actions'

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
      <div>
        <textarea
          value={response}
          rows={3}
          maxLength={2000}
          autoFocus={autoFocus}
          onChange={(e) => { setResponse(e.target.value); setError(null) }}
          placeholder={placeholder}
          className="w-full px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors resize-none"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <input
          type="date"
          value={occurredOn}
          max={today}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-xs focus:outline-none transition-colors"
          aria-label="When did this happen?"
        />

        <div className="flex-1" />

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2.5 text-prose-faint hover:text-prose text-sm font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={pending || response.trim().length === 0}
          className="px-4 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {pending ? 'Capturing…' : 'Capture'}
        </button>
      </div>

      {error && <p className="text-sm text-danger-ink">{error}</p>}
    </form>
  )
}
