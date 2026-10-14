'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

// The one open/close behaviour for anything that drops down from a trigger —
// menus, the activity feed, thread options. Every hand-rolled dropdown on the
// site re-implemented a subset of this and each missed a different piece: one
// listened for `mousedown` (dead on touch-then-scroll), one never closed on
// navigation (the panel lingered on the destination page), none returned focus
// to the trigger, none told assistive tech the panel existed.
//
//   Esc                → close, focus back to the trigger
//   pointerdown outside→ close, focus stays where the user put it
//   route change       → close (an in-panel <Link> navigates without an outside click)
//   close()            → close, focus back to the trigger (item picked)
//
// `popup` sets `aria-haspopup` — pass it ONLY when the panel really is that
// role: 'menu' means arrow-key navigation ships (it doesn't yet), 'dialog'
// means the panel is a role="dialog" region. A plain disclosure of links
// omits it; announcing a menu that doesn't behave like one is worse than
// announcing nothing.

type Popup = 'menu' | 'dialog' | 'listbox'

export function useDisclosure({ popup }: { popup?: Popup } = {}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Close on route change — the render-time "adjust state on prop change"
  // pattern, not an effect, so the stale panel never paints on the new page.
  const pathname = usePathname()
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (open) setOpen(false)
  }

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  const toggle = useCallback(() => setOpen((o) => !o), [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || triggerRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return {
    open,
    setOpen,
    toggle,
    close,
    triggerProps: {
      ref: triggerRef,
      onClick: toggle,
      'aria-expanded': open,
      // Only while the panel exists — an IDREF to an unmounted node is invalid.
      'aria-controls': open ? panelId : undefined,
      ...(popup ? { 'aria-haspopup': popup } : {}),
    },
    panelProps: { ref: panelRef, id: panelId },
  }
}

export type Disclosure = ReturnType<typeof useDisclosure>
export type DisclosureTriggerProps = Disclosure['triggerProps']
