'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'

// Hide-on-scroll for the mobile bottom tab strip, on READING pages only.
//
// Scrolling down through a review or guide slides the strip away so the
// content gets the screen; any scroll up (or reaching the end of the page)
// brings it straight back — the Safari / Medium pattern. App-like surfaces
// (Tools, account, listings) keep the strip pinned: there the tabs ARE the
// content's navigation.
//
// ONE store, many readers: the strip, the review buy bar and the install prompt
// all position off this value, so they must agree on the same frame. A hook per
// component would run three scroll listeners that could disagree mid-flick.

const READING_ROUTE = /^\/(reviews|guides)\/(?!category\/|tag\/)[^/]+\/?$/

export function isReadingRoute(pathname: string) {
  return READING_ROUTE.test(pathname)
}

const DELTA = 8         // ignore jitter smaller than this
const REVEAL_TOP = 120  // always shown near the top of the page
const REVEAL_END = 80   // ...and within this of the bottom

let hidden = false
let lastY = 0
const listeners = new Set<() => void>()

function onScroll() {
  const y = window.scrollY
  const dy = y - lastY
  if (Math.abs(dy) < DELTA) return
  lastY = y
  const atEnd = window.innerHeight + y >= document.documentElement.scrollHeight - REVEAL_END
  const next = dy > 0 && y > REVEAL_TOP && !atEnd
  if (next !== hidden) {
    hidden = next
    listeners.forEach((l) => l())
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    lastY = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      window.removeEventListener('scroll', onScroll)
      hidden = false
    }
  }
}

/** True while the mobile bottom strip is slid away (reading pages only). */
export function useBottomNavHidden() {
  const pathname = usePathname()
  const scrolledAway = useSyncExternalStore(subscribe, () => hidden, () => false)
  return scrolledAway && isReadingRoute(pathname)
}
