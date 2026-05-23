'use client'

import Link from 'next/link'

export interface ReadinessCheck {
  label: string
  done: boolean
}

interface Props {
  isSaving: boolean
  isPublishing?: boolean
  isDeleting?: boolean
  isPublished: boolean
  onSave: () => void
  onPublish: () => void
  onUnpublish?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  previewUrl?: string | null
  canPublish?: boolean
  publishBlockedReason?: string | null
  readinessChecks?: ReadinessCheck[]
  previewOpen?: boolean
  onTogglePreview?: () => void
}

export function WorkspaceToolbar({
  isSaving, isPublishing, isDeleting, isPublished,
  onSave, onPublish, onUnpublish, onDelete, onDuplicate,
  previewUrl, canPublish = true, publishBlockedReason, readinessChecks,
  previewOpen, onTogglePreview,
}: Props) {
  const readyCount  = readinessChecks?.filter((c) => c.done).length ?? 0
  const readyTotal  = readinessChecks?.length ?? 0
  const firstMissing = readinessChecks?.find((c) => !c.done)?.label
  const readyTooltip = readinessChecks?.map((c) => `${c.done ? '✓' : '✗'} ${c.label}`).join('\n')

  return (
    <div className="sticky bottom-0 left-0 right-0 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-surface-sunken/95 backdrop-blur border-t border-soft flex items-center gap-2 flex-wrap z-10">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-3 bg-surface-raised hover:bg-stone-100 disabled:opacity-50 text-prose text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            className="px-3 py-3 bg-surface-raised hover:bg-stone-100 text-prose-muted text-sm rounded-lg transition-colors"
            title="Create a new draft with this content"
          >
            📋 Duplicate
          </button>
        )}
        {onTogglePreview && (
          <button
            type="button"
            onClick={onTogglePreview}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-3 text-sm rounded-lg transition-colors ${
              previewOpen
                ? 'bg-accent-tint text-accent-text-soft border border-accent-border/40'
                : 'bg-surface-raised hover:bg-stone-100 text-prose-muted'
            }`}
            title="Toggle live preview panel"
          >
            👁 Preview
          </button>
        )}
        {previewUrl && (
          <Link
            href={previewUrl}
            target="_blank"
            className="px-3 py-3 bg-surface-raised hover:bg-stone-100 text-prose-muted text-sm rounded-lg transition-colors"
          >
            🔗 Preview
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="px-3 py-3 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting…' : '🗑 Delete'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Readiness checklist — full badge strip ≥sm; compact summary <sm */}
        {!isPublished && readinessChecks && readinessChecks.length > 0 && (
          <>
            <span
              title={readyTooltip}
              className={`sm:hidden text-xs px-2.5 py-1 rounded-full font-medium border ${
                readyCount === readyTotal
                  ? 'bg-green-50 text-green-500 border-green-200'
                  : 'bg-amber-50 text-amber-600 border-amber-200'
              }`}
            >
              {readyCount === readyTotal
                ? `✓ Ready (${readyCount}/${readyTotal})`
                : `${readyCount}/${readyTotal} · ${firstMissing} missing`}
            </span>
            <div className="hidden sm:flex items-center gap-1.5 flex-wrap mr-2">
              {readinessChecks.map((check) => (
                <span
                  key={check.label}
                  title={check.label}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    check.done
                      ? 'bg-green-50 text-green-500 border border-green-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {check.done ? '✓' : '✗'} {check.label}
                </span>
              ))}
            </div>
          </>
        )}
        {isPublished && onUnpublish && (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={isPublishing}
            className="px-4 py-3 bg-amber-50 hover:bg-amber-50 disabled:opacity-50 text-amber-700 text-sm font-semibold rounded-lg transition-colors border border-amber-200"
          >
            {isPublishing ? '…' : 'Unpublish'}
          </button>
        )}
        {!isPublished && (
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || !canPublish}
            title={!canPublish ? (publishBlockedReason ?? undefined) : undefined}
            className="px-5 py-3 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPublishing ? 'Publishing…' : '✓ Publish Live'}
          </button>
        )}
      </div>
    </div>
  )
}
