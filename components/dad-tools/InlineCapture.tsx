'use client'

// Toggle wrapper around CaptureMomentForm — "Capture a moment" button
// that expands the form on click. Same pattern as KidCard's capture
// affordance, isolated here so the kid profile page can drop it into the
// Presence card without bringing along the rest of KidCard.

import { useState } from 'react'
import CaptureMomentForm from './CaptureMomentForm'

interface Props {
  kidProfileId: string
  kidName?: string | null
  ctaLabel?: string
}

export default function InlineCapture({
  kidProfileId, kidName, ctaLabel = 'Capture a moment',
}: Props) {
  const [open, setOpen] = useState(false)

  if (open) {
    return (
      <CaptureMomentForm
        kidProfileId={kidProfileId}
        kidName={kidName}
        autoFocus
        onSuccess={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full sm:w-auto text-left px-4 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors"
    >
      {ctaLabel}
    </button>
  )
}
