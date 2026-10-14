'use client'

// Owner-only quick-actions menu on a goal card in the listing. Surfaces
// Edit / Pause / Archive (or Restore) / Delete without drilling into the goal's
// edit page. Rendered beside the card's wrapping <Link> (it can't live inside
// an anchor). Built on the shared <Menu> (continuity plan P3).

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archiveGoal, pauseGoal, resumeGoal, deleteGoal } from '@/lib/dad-tools/savings-actions'
import { Menu, MenuItem, MenuDivider } from '@/components/ui/Menu'
import { IconButton } from '@/components/ui/IconButton'
import { useConfirm } from '@/components/ui/useConfirm'

interface Props {
  goalId:   string
  goalName: string
  status:   'active' | 'paused' | 'completed' | 'archived'
}

export default function GoalCardMenu({ goalId, goalName, status }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { confirm: askConfirm, dialog } = useConfirm()

  const isArchived = status === 'archived'
  const isPaused = status === 'paused'

  function onPauseToggle() {
    setError(null)
    startTransition(async () => {
      const result = isPaused ? await resumeGoal(goalId) : await pauseGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  function onArchiveToggle() {
    setError(null)
    startTransition(async () => {
      const result = isArchived ? await resumeGoal(goalId) : await archiveGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  async function onDelete() {
    const ok = await askConfirm({
      title: `Delete "${goalName}" forever?`,
      body: 'This removes the goal and EVERY contribution, withdrawal, and adjustment tied to it. This cannot be undone.',
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await deleteGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      router.refresh()
    })
  }

  return (
    <>
      <Menu
        label="Goal actions"
        trigger={(p) => (
          <IconButton {...p} label="Goal actions">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="12" cy="19" r="1.8" />
            </svg>
          </IconButton>
        )}
      >
        <MenuItem href={`/tools/savings/${goalId}/edit`}>Edit</MenuItem>
        {!isArchived && (
          <MenuItem onSelect={onPauseToggle}>{isPaused ? 'Resume goal' : 'Pause goal'}</MenuItem>
        )}
        <MenuItem onSelect={onArchiveToggle}>{isArchived ? 'Restore from archive' : 'Archive'}</MenuItem>
        <MenuDivider />
        <MenuItem onSelect={onDelete} danger>Delete permanently</MenuItem>
      </Menu>
      {error && (
        <p role="alert" className="absolute right-0 top-12 w-48 text-xs font-medium text-danger-ink leading-snug">{error}</p>
      )}
      {dialog}
    </>
  )
}
