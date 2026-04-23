'use client'

import { useEffect } from 'react'

type ShortcutMap = Record<string, (e: KeyboardEvent) => void>

/**
 * Register global keyboard shortcuts. Keys use this format:
 * - 'mod+s' — Cmd on Mac, Ctrl on Windows/Linux
 * - 'mod+shift+p' — combined modifiers
 * - 'esc' — plain escape
 */
export function useKeyboardShortcuts(shortcuts: ShortcutMap, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    function parse(keyspec: string) {
      const parts = keyspec.toLowerCase().split('+').map(p => p.trim())
      return {
        mod:   parts.includes('mod'),
        shift: parts.includes('shift'),
        alt:   parts.includes('alt'),
        key:   parts[parts.length - 1],
      }
    }

    function handler(e: KeyboardEvent) {
      for (const [spec, fn] of Object.entries(shortcuts)) {
        const s = parse(spec)
        const mod = e.metaKey || e.ctrlKey
        if (
          (!s.mod || mod) &&
          (s.mod || !mod) &&
          s.shift === e.shiftKey &&
          s.alt === e.altKey &&
          e.key.toLowerCase() === s.key
        ) {
          e.preventDefault()
          fn(e)
          return
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])
}
