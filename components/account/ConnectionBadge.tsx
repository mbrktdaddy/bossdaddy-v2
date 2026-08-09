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

import { useEffect, useState } from 'react'

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
    <span
      aria-label={`${count} waiting on you`}
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-black leading-none text-white"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}
