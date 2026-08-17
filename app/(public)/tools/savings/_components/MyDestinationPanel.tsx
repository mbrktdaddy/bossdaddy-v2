'use client'

// Per-participant destination editor — visible to non-owner participants
// on goals running in `per_participant` destination mode. Lets each
// participant set their own payment destination (e.g., the spouse routes
// to their personal PayPal instead of the owner's joint pool).
//
// Lighter than the full create-flow brand-picker: just label + URL +
// auto-detect feedback, plus a save button. Reuses describeDestination
// for the live-detection chip.

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { DestinationType } from '@/lib/dad-tools/savings'
import { updateParticipantDestination } from '@/lib/dad-tools/savings-actions'
import { describeDestination } from '@/lib/dad-tools/savings-deeplinks'

interface Props {
  goalId:                     string
  initialLabel:               string
  initialUrl:                 string
  initialType:                DestinationType | null
}

export default function MyDestinationPanel({
  goalId, initialLabel, initialUrl, initialType,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [label, setLabel] = useState(initialLabel)
  const [url, setUrl] = useState(initialUrl)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const behavior = useMemo(() => describeDestination(url.trim() || null), [url])
  const hasChanges = label.trim() !== initialLabel.trim() || url.trim() !== initialUrl.trim()

  function onSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateParticipantDestination({
        goalId,
        destination_label: label.trim() || null,
        destination_url:   url.trim() || null,
        // Auto-detect the type from the URL — matches the goal-creation flow.
        // Falls back to the previous type when the URL clears the auto-detect.
        destination_type:  behavior.type ?? initialType,
      })
      if (!result.ok) { setError(result.error); return }
      setSaved(true)
      router.refresh()
      // Auto-clear the saved confirmation after 3 seconds
      window.setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <section className="bg-surface border border-soft rounded-xl p-5 space-y-4">
      <div>
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
          Your destination
        </p>
        <p className="text-xs text-prose-faint leading-snug">
          Where YOUR contributions go on this goal. The owner sets a different
          one — yours is private to you.
        </p>
      </div>

      <div>
        <label htmlFor="my-dest-label" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
          Label
        </label>
        <input
          id="my-dest-label"
          type="text"
          maxLength={120}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My PayPal · Chase savings · Cash jar"
          className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div>
        <label htmlFor="my-dest-url" className="block text-xs text-prose-faint uppercase tracking-widest mb-2">
          URL or handle <span className="text-prose-faint normal-case">(optional)</span>
        </label>
        <input
          id="my-dest-url"
          type="text"
          maxLength={500}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="paypal.me/yourname · @venmo · bank login URL · or leave blank"
          className="w-full px-3 py-2.5 bg-surface-sunken border border-soft focus:border-accent rounded-lg text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <div className={`mt-2 px-3 py-2 rounded-lg border text-xs leading-snug ${
          behavior.willPrefill
            ? 'bg-success-bg border-success-line text-success-ink'
            : behavior.willOpenUrl
              ? 'bg-info-bg border-info-line text-info-ink'
              : 'bg-surface-sunken border-soft text-prose-muted'
        }`}>
          {behavior.message}
        </div>
      </div>

      {error && (
        <div className="bg-danger-bg border border-danger-line text-danger-ink rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {saved && (
        <div className="bg-success-bg border border-success-line text-success-ink rounded-lg px-3 py-2 text-sm">
          Saved.
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={pending || !hasChanges}
        className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
      >
        {pending ? 'Saving…' : 'Save destination'}
      </button>
    </section>
  )
}
