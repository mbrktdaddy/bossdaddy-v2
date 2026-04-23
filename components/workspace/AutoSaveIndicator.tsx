'use client'

export type SaveState = 'idle' | 'saving' | 'saved' | 'dirty' | 'error'

export function AutoSaveIndicator({ state, error }: { state: SaveState; error?: string | null }) {
  const config = {
    idle:   { text: '',                  className: 'text-gray-600' },
    saving: { text: 'Saving…',           className: 'text-orange-400' },
    saved:  { text: '✓ All changes saved', className: 'text-green-400' },
    dirty:  { text: '● Unsaved changes', className: 'text-yellow-500' },
    error:  { text: `⚠ ${error ?? 'Save failed'}`, className: 'text-red-400' },
  }[state]

  if (!config.text) return null

  return (
    <span className={`text-xs font-medium ${config.className} transition-colors`}>
      {config.text}
    </span>
  )
}
