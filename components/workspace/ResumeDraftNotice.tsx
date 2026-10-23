'use client'

import { useEffect, useState } from 'react'
import { Notice } from '@/components/ui/Notice'
import { buttonVariants } from '@/components/ui/Button'
import { STAGE_LABEL, relTime } from './PipelineRunner'
import type { RunState } from '@/lib/content/pipeline/types'

// The wizards' idea step: if an unfinished run exists for this author and
// type, say so up front. Before this, the resume banner lived only inside the
// pipeline step — an author who closed the tab mid-draft (or switched from the
// phone to the laptop, where the form's localStorage copy doesn't exist) had to
// invent a brief just to reach it. "Continue" hands the runner a null brief
// (resume-only mode); the runner's own banner then offers Resume / Back.

interface Props {
  contentType: 'review' | 'guide'
  onContinue: () => void
}

export function ResumeDraftNotice({ contentType, onContinue }: Props) {
  const [run, setRun] = useState<RunState | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/content/runs?type=${contentType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { run?: RunState | null } | null) => { if (!cancelled && j?.run) setRun(j.run) })
      .catch(() => { /* a failed lookup just means no notice */ })
    return () => { cancelled = true }
  }, [contentType])

  if (!run) return null
  return (
    <Notice
      title="You have an unfinished draft"
      action={<button type="button" onClick={onContinue} className={buttonVariants()}>Continue</button>}
    >
      {run.outline?.title ?? 'Untitled'} — left at the {STAGE_LABEL[run.status]} stage, {relTime(run.updatedAt)}
      {run.costUsd > 0 ? ` · $${run.costUsd.toFixed(2)} spent` : ''}.
    </Notice>
  )
}
