'use client'

import { useEffect, useState } from 'react'

interface Props {
  /** CSS selector of the article body to track. Defaults to the bd-content wrapper. */
  target?: string
}

export default function ReadingProgressBar({ target = '.bd-content' }: Props) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = document.querySelector(target) as HTMLElement | null
    if (!el) return

    function update() {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const articleHeight = el.offsetHeight
      const viewportHeight = window.innerHeight
      // How much of the article has scrolled past the top of viewport
      // (clamped, normalized to 0..1)
      const scrolled = Math.min(
        Math.max(0, -rect.top + viewportHeight * 0.3),
        articleHeight,
      )
      setProgress(articleHeight > 0 ? Math.min(100, (scrolled / articleHeight) * 100) : 0)
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [target])

  return (
    <div
      className="fixed top-16 left-0 right-0 h-0.5 z-40 pointer-events-none"
      aria-hidden
    >
      <div
        className="h-full bg-orange-500 transition-[width] duration-100 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}
