'use client'

import type { ReactNode } from 'react'
import { AutoSaveIndicator, type SaveState } from '@/components/workspace/AutoSaveIndicator'
import { StatusBadge } from '@/components/workspace/StatusBadge'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'

interface AutoSave {
  state: SaveState
  error: string | null
}

interface Props {
  /** Header: back link target (e.g. /dashboard/guides) */
  backHref: string
  /** Header: back link label (e.g. "All guides") */
  backLabel: string
  /** Header: large title in the masthead */
  title: string
  /** Header: subtitle line under the title (created date, reading time, etc.) */
  subtitle: string
  /** Used by the header chrome: status badge + autosave indicator on the right */
  status: string
  autoSave: AutoSave

  /** When non-empty AND status is draft/rejected, render the amber "edits requested" banner */
  rejectionReason?: string | null

  /** Action feedback messages — bottom of the editor column, above the toolbar */
  actionErr?: string | null
  actionMsg?: string | null

  /**
   * The toolbar (WorkspaceToolbar) the consumer wants rendered.
   * Placed by the shell at the sticky-bottom position.
   * Pass as ReactNode so consumers control their own toolbar prop wiring.
   */
  toolbar: ReactNode

  /**
   * Optional right-side preview column (e.g. ReviewDraftPreview). When provided,
   * the shell switches the body to a 2-col xl flex layout. When omitted, the
   * body is a single column. Pass undefined/null for guide-style workspaces.
   */
  previewSlot?: ReactNode

  /** Dialogs/modals rendered at the root of the shell after everything else */
  modals?: ReactNode

  /** The actual workspace sections — the type-specific content */
  children: ReactNode
}

/**
 * Shared scaffold for content workspaces (reviews, guides). Owns all the
 * type-agnostic chrome — header masthead, rejection banner, action feedback,
 * keyboard shortcut hint, toolbar placement, preview column layout, modal slot.
 *
 * Consumers (ReviewWorkspace, GuideWorkspace) render their type-specific
 * editor sections as children. Type-specific modals (ScheduleFollowupModal,
 * RefinePreviewModal) go through the `modals` prop.
 */
export function WorkspaceShell({
  backHref,
  backLabel,
  title,
  subtitle,
  status,
  autoSave,
  rejectionReason,
  actionErr,
  actionMsg,
  toolbar,
  previewSlot,
  modals,
  children,
}: Props) {
  const showRejection = !!rejectionReason && ['draft', 'rejected'].includes(status)
  const hasPreview = !!previewSlot

  return (
    <div className="p-4 sm:p-8 max-w-4xl">

      <WorkspaceHeader
        backHref={backHref}
        backLabel={backLabel}
        title={title || 'Untitled'}
        subtitle={subtitle}
        rightSlot={
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <AutoSaveIndicator state={autoSave.state} error={autoSave.error} />
            <StatusBadge status={status} />
          </div>
        }
      />

      {showRejection && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300">
          <p className="text-sm text-amber-700">
            <strong>Edits requested:</strong> {rejectionReason}
          </p>
        </div>
      )}

      {/* When previewSlot is present, body becomes flex with the preview on the right */}
      <div className={hasPreview ? 'xl:flex xl:gap-6 xl:items-start' : ''}>

        {/* Editor column */}
        <div className={`space-y-6 ${hasPreview ? 'xl:flex-1 xl:min-w-0' : ''}`}>
          {children}

          {actionErr && (
            <p className="text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg px-4 py-3">
              {actionErr}
            </p>
          )}
          {actionMsg && (
            <p className="text-forest text-sm bg-green-50 border border-green-300 rounded-lg px-4 py-3">
              {actionMsg}
            </p>
          )}

          <p className="text-xs text-prose-faint">
            ⌨ <kbd className="px-1 py-0.5 bg-surface-raised rounded">⌘S</kbd> save ·{' '}
            <kbd className="px-1 py-0.5 bg-surface-raised rounded">⌘↵</kbd> publish ·{' '}
            <kbd className="px-1 py-0.5 bg-surface-raised rounded">⌘Z</kbd> undo ·{' '}
            <kbd className="px-1 py-0.5 bg-surface-raised rounded">⌘⇧Z</kbd> redo
          </p>
        </div>

        {/* Optional preview column (xl only) */}
        {hasPreview && (
          <div className="hidden xl:block w-[420px] shrink-0 sticky top-6 self-start">
            {previewSlot}
          </div>
        )}

      </div>

      {toolbar}

      {modals}
    </div>
  )
}
