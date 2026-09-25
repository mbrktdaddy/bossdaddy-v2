'use client'

import { buttonVariants } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

interface Props {
  before: string   // current content HTML
  after: string    // proposed content HTML
  onAccept: () => void
  onDiscard: () => void
}

// prose-invert is load-bearing: without it --tw-prose-headings is zinc-900,
// which equals the dark surface these render on, so headings go invisible.
// See TiptapEditor for the full note.
const proseClasses = `
  prose prose-sm prose-zinc prose-invert prose-orange max-w-none
  prose-headings:font-black prose-headings:font-sans prose-headings:tracking-tight
  prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-1
  prose-p:text-prose-muted prose-p:leading-relaxed prose-p:text-xs
  prose-a:text-accent-text-soft prose-a:no-underline
  prose-strong:text-prose prose-li:text-xs prose-li:text-prose-muted
`.trim()

export function RefinePreviewModal({ before, after, onAccept, onDiscard }: Props) {
  return (
    <Modal onClose={onDiscard} label="Review AI changes" size="xl" closeOnBackdrop={false} className="flex flex-col h-[calc(100dvh-2rem)] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft shrink-0">
          <div>
            <p className="text-sm font-bold text-prose">Review AI changes before applying</p>
            <p className="text-xs text-prose-faint mt-0.5">Left = current content · Right = proposed changes</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscard}
              className={buttonVariants({ variant: 'secondary' })}
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onAccept}
              className={buttonVariants()}
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
            <div className="px-4 py-2 bg-accent-tint border-b border-accent-border/30 shrink-0">
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

    </Modal>
  )
}
