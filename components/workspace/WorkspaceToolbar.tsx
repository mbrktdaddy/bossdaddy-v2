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
}

export function WorkspaceToolbar({
  isSaving, isPublishing, isDeleting, isPublished,
  onSave, onPublish, onUnpublish, onDelete, onDuplicate,
  previewUrl, canPublish = true, publishBlockedReason, readinessChecks,
}: Props) {
  const incomplete = readinessChecks?.filter((c) => !c.done) ?? []
  const allReady   = incomplete.length === 0

  return (
    <div className="sticky bottom-0 left-0 right-0 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-gray-950/95 backdrop-blur border-t border-gray-800 flex items-center gap-2 flex-wrap z-10">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            title="Create a new draft with this content"
          >
            📋 Duplicate
          </button>
        )}
        {previewUrl && (
          <Link
            href={previewUrl}
            target="_blank"
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
          >
            🔗 Preview
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="px-3 py-2 text-red-400 hover:bg-red-950/40 disabled:opacity-50 text-sm rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting…' : '🗑 Delete'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Readiness checklist — shown when not yet published */}
        {!isPublished && readinessChecks && readinessChecks.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap mr-2">
            {readinessChecks.map((check) => (
              <span
                key={check.label}
                title={check.label}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  check.done
                    ? 'bg-green-950/60 text-green-500 border border-green-900/40'
                    : 'bg-red-950/60 text-red-400 border border-red-900/40'
                }`}
              >
                {check.done ? '✓' : '✗'} {check.label}
              </span>
            ))}
          </div>
        )}
        {isPublished && onUnpublish && (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={isPublishing}
            className="px-4 py-2 bg-yellow-900/60 hover:bg-yellow-900 disabled:opacity-50 text-yellow-300 text-sm font-semibold rounded-lg transition-colors border border-yellow-900/40"
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
            className="px-5 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPublishing ? 'Publishing…' : '✓ Publish Live'}
          </button>
        )}
      </div>
    </div>
  )
}
