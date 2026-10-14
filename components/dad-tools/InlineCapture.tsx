'use client'

// Toggle wrapper around CaptureMomentForm — "Capture a moment" button
// that expands the form on click. Same pattern as KidCard's capture
// affordance, isolated here so the kid profile page can drop it into the
// Presence card without bringing along the rest of KidCard.

import { useState } from 'react'
import CaptureMomentForm from './CaptureMomentForm'
import { buttonVariants } from '@/components/ui/Button'

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
      className={buttonVariants({ className: 'w-full sm:w-auto' })}
    >
      {ctaLabel}
    </button>
  )
}
