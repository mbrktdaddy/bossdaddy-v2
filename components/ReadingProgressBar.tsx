'use client'

import { useEffect, useState } from 'react'

/**
 * Thin orange bar pinned to the very top of the viewport, fills as the user
 * scrolls down the page. Sits above the sticky header so it remains visible.
 */
export default function ReadingProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function onScroll() {
      const scrolled = window.scrollY
      const total = document.documentElement.scrollHeight - window.innerHeight
      const pct = total > 0 ? Math.min(100, (scrolled / total) * 100) : 0
      setProgress(pct)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div
      className="fixed top-0 left-0 z-[60] h-0.5 bg-orange-500 transition-[width] duration-100 ease-out"
      style={{ width: `${progress}%` }}
      aria-hidden="true"
    />
  )
}
