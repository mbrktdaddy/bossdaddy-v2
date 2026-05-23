'use client'

export type SaveState = 'idle' | 'saving' | 'saved' | 'dirty' | 'error'

export function AutoSaveIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  const config = {
    idle:   { text: '',                  className: 'text-prose-faint' },
    saving: { text: 'Saving…',           className: 'text-accent-text-soft' },
    saved:  { text: '✓ All changes saved', className: 'text-forest' },
    dirty:  { text: '● Unsaved changes', className: 'text-amber-600' },
    error:  { text: `⚠ ${error ?? 'Save failed'}`, className: 'text-red-600' },
  }[state]

  if (!config.text) return null

  return (
    <span className={`text-xs font-medium ${config.className} transition-colors`}>
      {config.text}
    </span>
  )
}
