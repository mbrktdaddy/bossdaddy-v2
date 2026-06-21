'use client'

// Owner-only quick-actions menu on a goal card in the listing. Surfaces
// Edit / Archive (or Restore) / Delete without drilling into the goal's edit
// page. Rendered ABOVE the card's wrapping <Link> (it can't live inside an
// anchor), so each handler stops propagation to avoid triggering navigation.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archiveGoal, resumeGoal, deleteGoal } from '@/lib/dad-tools/savings-actions'

interface Props {
  goalId:   string
  goalName: string
  status:   'active' | 'paused' | 'completed' | 'archived'
}

export default function GoalCardMenu({ goalId, goalName, status }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isArchived = status === 'archived'

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function onEdit(e: React.MouseEvent) {
    stop(e)
    router.push(`/tools/savings/${goalId}/edit`)
  }

  function onArchiveToggle(e: React.MouseEvent) {
    stop(e)
    setError(null)
    startTransition(async () => {
      const result = isArchived ? await resumeGoal(goalId) : await archiveGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  function onDelete(e: React.MouseEvent) {
    stop(e)
    const ok = window.confirm(
      `Delete "${goalName}" forever?\n\nThis removes the goal and EVERY contribution, withdrawal, and adjustment tied to it. This cannot be undone.`,
    )
    if (!ok) return
    setError(null)
    startTransition(async () => {
      const result = await deleteGoal(goalId)
      if (!result.ok) { setError(result.error); return }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Goal actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => { stop(e); setOpen((v) => !v) }}
        className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface/80 backdrop-blur border border-soft text-prose-muted hover:text-prose hover:border-strong transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={(e) => { stop(e); setOpen(false) }}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-10 z-20 w-44 bg-surface border border-strong rounded-xl p-1 shadow-lg shadow-black/30"
          >
            <MenuItem onClick={onEdit} disabled={pending}>Edit</MenuItem>
            <MenuItem onClick={onArchiveToggle} disabled={pending}>
              {isArchived ? 'Restore from archive' : 'Archive'}
            </MenuItem>
            <MenuItem onClick={onDelete} disabled={pending} danger>
              Delete permanently
            </MenuItem>
            {error && (
              <p className="px-3 py-1.5 text-[11px] text-danger-ink leading-snug">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  onClick, disabled, danger, children,
}: {
  onClick: (e: React.MouseEvent) => void
  disabled: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
        danger
          ? 'text-danger-ink hover:bg-danger-bg'
          : 'text-prose-muted hover:text-prose hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  )
}
