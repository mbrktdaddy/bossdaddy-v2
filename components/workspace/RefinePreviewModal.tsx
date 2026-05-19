'use client'

import { useEffect } from 'react'

interface Props {
  before: string   // current content HTML
  after: string    // proposed content HTML
  onAccept: () => void
  onDiscard: () => void
}

const proseClasses = `
  prose prose-sm prose-invert prose-orange max-w-none
  prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight
  prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-1
  prose-p:text-gray-300 prose-p:leading-relaxed prose-p:text-xs
  prose-a:text-accent-text-soft prose-a:no-underline
  prose-strong:text-white prose-li:text-xs prose-li:text-gray-300
`.trim()

export function RefinePreviewModal({ before, after, onAccept, onDiscard }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDiscard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDiscard])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-6xl mx-auto my-4 mx-4 bg-surface-sunken border border-soft rounded-2xl overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Review AI changes before applying</p>
            <p className="text-xs text-prose-faint mt-0.5">Left = current content · Right = proposed changes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              className="px-4 py-2 bg-surface-raised hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-lg transition-colors"
            >
              ✓ Accept changes
            </button>
          </div>
        </div>

        {/* Two-pane diff */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Before */}
          <div className="flex-1 min-w-0 border-r border-soft flex flex-col">
            <div className="px-4 py-2 bg-surface border-b border-soft shrink-0">
              <span className="text-xs font-semibold text-prose-muted uppercase tracking-widest">Before</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                className={proseClasses}
                dangerouslySetInnerHTML={{ __html: before || '<p class="text-prose-faint italic">No content yet.</p>' }}
              />
            </div>
          </div>

          {/* After */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="px-4 py-2 bg-accent-tint/40 border-b border-accent-border/30 shrink-0">
              <span className="text-xs font-semibold text-accent-text-soft uppercase tracking-widest">After (proposed)</span>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                className={proseClasses}
                dangerouslySetInnerHTML={{ __html: after || '<p class="text-prose-faint italic">No content proposed.</p>' }}
              />
            </div>
          </div>

        </div>

        {/* Footer shortcut hint */}
        <div className="px-5 py-2.5 border-t border-soft shrink-0 flex items-center gap-4">
          <p className="text-xs text-prose-faint">Scroll both panes independently to compare specific sections.</p>
          <button type="button" onClick={onDiscard} className="ml-auto text-xs text-prose-faint hover:text-prose-muted transition-colors">
            Esc to discard
          </button>
        </div>

      </div>
    </div>
  )
}
