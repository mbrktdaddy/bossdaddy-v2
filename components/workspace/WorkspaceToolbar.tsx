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
  const readyTooltip = readinessChecks?.map((c) => `${c.done ? '✓' : '✗'} ${c.label}`).join('\n')

  return (
    <div className="sticky bottom-0 left-0 right-0 -mx-4 sm:-mx-8 px-4 sm:px-8 py-3 bg-surface-sunken/95 backdrop-blur border-t border-soft flex items-center gap-2 flex-wrap z-10">
      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-3 bg-surface-raised hover:bg-surface disabled:opacity-50 text-prose text-sm font-medium rounded-lg transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save'}
        </button>
        {onDuplicate && (
          <button
            type="button"
            onClick={onDuplicate}
            className="px-3 py-3 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-lg transition-colors"
            title="Create a new draft with this content"
          >
            <svg className="w-4 h-4 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" /></svg>
            Duplicate
          </button>
        )}
        {onTogglePreview && (
          <button
            type="button"
            onClick={onTogglePreview}
            className={`hidden xl:flex items-center gap-1.5 px-3 py-3 text-sm rounded-lg transition-colors ${
              previewOpen
                ? 'bg-accent-tint text-accent-text-soft border border-accent-border/40'
                : 'bg-surface-raised hover:bg-surface text-prose-muted'
            }`}
            title="Toggle live preview panel"
          >
            <svg className="w-4 h-4 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Preview
          </button>
        )}
        {previewUrl && (
          <Link
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-3 bg-surface-raised hover:bg-surface text-prose-muted text-sm rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 mr-1.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
            Preview
          </Link>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="px-3 py-3 text-red-700 hover:bg-red-50 disabled:opacity-50 text-sm rounded-lg transition-colors"
          >
            {isDeleting ? 'Deleting…' : (
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                Delete
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Readiness — compact on every viewport so the sticky bar stays one
            line: a single "Ready" pill when complete (full list on hover), or
            only the MISSING checks when not. The old desktop strip showed all
            8-9 badges, wrapping the bar tall and crowding the actions. */}
        {!isPublished && readinessChecks && readinessChecks.length > 0 && (
          readyCount === readyTotal ? (
            <span
              title={readyTooltip}
              className="text-xs px-2.5 py-1 rounded-full font-medium border bg-green-50 text-green-600 border-green-300 whitespace-nowrap"
            >
              ✓ Ready ({readyCount}/{readyTotal})
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap mr-1" title={readyTooltip}>
              <span className="text-xs text-prose-faint whitespace-nowrap">{readyCount}/{readyTotal} ready —</span>
              {readinessChecks.filter((c) => !c.done).map((check) => (
                <span
                  key={check.label}
                  className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-300 whitespace-nowrap"
                >
                  ✗ {check.label}
                </span>
              ))}
            </div>
          )
        )}
        {isPublished && onUnpublish && (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={isPublishing}
            className="px-4 py-3 bg-amber-50 hover:bg-amber-50 disabled:opacity-50 text-amber-700 text-sm font-semibold rounded-lg transition-colors border border-amber-300"
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
