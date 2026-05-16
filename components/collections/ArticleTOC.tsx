'use client'

import { useEffect, useState } from 'react'

export interface TOCItem {
  id:    string
  label: string
}

interface Props {
  items:    TOCItem[]
  /**
   * `mobile` renders sticky pill strip at viewport top; place INSIDE the
   * article column near the top so source order stays linear.
   * `desktop` renders the right rail; place as a sibling of <main> in a
   * lg:flex parent so it occupies its own column.
   */
  variant:  'mobile' | 'desktop'
}

/**
 * Reading-rail nav for long collection pages. Split into two variants the
 * parent composes so mobile pills can sit inside the article flow at the
 * top while the desktop rail occupies its own right column.
 *
 * The parent page is responsible for matching each item.id to a section
 * with that id on the page. Items render in order — keep the parent's
 * source array authoritative.
 */
export default function ArticleTOC({ items, variant }: Props) {
  const [activeId, setActiveId] = useState<string | null>(items[0]?.id ?? null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length === 0) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActiveId(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: [0, 0.1, 0.5, 1] },
    )
    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  if (variant === 'mobile') {
    return (
      // Site header is `sticky top-0 z-50 h-16` — pinning the mobile TOC at
      // `top-16` keeps it directly below the header instead of slipping
      // behind it as the user scrolls. z-10 stays under the header z-50.
      <nav
        aria-label="On this page"
        className="lg:hidden -mx-6 mb-8 px-6 sticky top-16 z-10 bg-gray-950/95 backdrop-blur py-3 border-y border-gray-800/60"
      >
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="shrink-0 text-[10px] font-bold text-orange-500 uppercase tracking-widest mr-1">
            On this page
          </span>
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors min-h-[36px] inline-flex items-center ${
                activeId === item.id
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-700 hover:text-gray-200'
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    )
  }

  return (
    <aside
      aria-label="On this page"
      className="hidden lg:block sticky top-24 self-start w-56 shrink-0"
    >
      <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3">On this page</p>
      <ul className="space-y-1 border-l border-gray-800/60 pl-3">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={`block py-1.5 text-xs font-medium border-l-2 -ml-3 pl-3 transition-colors ${
                activeId === item.id
                  ? 'text-orange-400 border-orange-500 font-bold'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700'
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
