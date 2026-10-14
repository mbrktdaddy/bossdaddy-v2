'use client'

// The count of people waiting on you, next to "Your Corner" in the nav.
//
// WHY A FETCH HERE IS CHEAP: both places this renders — the desktop avatar
// dropdown and the mobile drawer — are conditionally mounted (`{userMenuOpen &&
// …}`), so this component only exists once a menu is actually open. Fetching on
// mount costs nothing on a page load, which is why the badge lives here rather
// than being threaded down from a layout as a prop and querying on every request.
//
// Renders NOTHING at zero, and nothing on failure. A badge showing 0 is worse
// than no badge — it draws the eye to say there's nothing to see.
//
// The stamp is the shared <CountBadge> (it used to be a hand-rolled rounded-full
// pill — one of six count dots that disagreed). CountBadge is aria-hidden, so the
// count is spoken through an sr-only sibling instead; it's absolutely positioned,
// so it adds nothing to the row's flex gap.

import { useEffect, useState } from 'react'
import { CountBadge } from '@/components/ui/CountBadge'

export default function ConnectionBadge() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch('/api/connections/pending')
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((j) => { if (!cancelled) setCount(Number(j?.count) || 0) })
      .catch(() => { /* silence — the nav still works */ })
    return () => { cancelled = true }
  }, [])

  if (count < 1) return null

  return (
    <>
      <CountBadge count={count} className="ml-auto" />
      <span className="sr-only">{count} waiting on you</span>
    </>
  )
}
