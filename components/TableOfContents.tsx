'use client'

import { useEffect, useState } from 'react'

interface TocItem {
  id: string
  text: string
  level: number // 2 or 3
}

interface Props {
  /** CSS selector of the article body to scan. Defaults to the bd-content wrapper. */
  target?: string
  /** Minimum number of headings to bother showing the TOC. Defaults to 3. */
  minHeadings?: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
}

export default function TableOfContents({ target = '.bd-content', minHeadings = 3 }: Props) {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Extract headings, ensure they have IDs, build TOC
  useEffect(() => {
    const el = document.querySelector(target)
    if (!el) return

    const headings = Array.from(el.querySelectorAll('h2, h3')) as HTMLHeadingElement[]
    const usedIds = new Set<string>()
    const collected: TocItem[] = []

    for (const h of headings) {
      const text = h.textContent?.trim() ?? ''
      if (!text) continue
      let id = h.id || slugify(text)
      if (!id) continue
      // Disambiguate duplicates
      let candidate = id
      let n = 2
      while (usedIds.has(candidate)) {
        candidate = `${id}-${n}`
        n++
      }
      id = candidate
      usedIds.add(id)
      h.id = id
      collected.push({ id, text, level: h.tagName === 'H3' ? 3 : 2 })
    }

    setItems(collected)
  }, [target])

  // Scroll-spy active heading
  useEffect(() => {
    if (items.length === 0) return
    const elements = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el)

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that's intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 },
    )

    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [items])

  if (items.length < minHeadings) return null

  return (
    <nav aria-label="Table of contents" className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">In this guide</p>
      <ul className="space-y-1.5 text-sm">
        {items.map((item) => {
          const isActive = activeId === item.id
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block py-1 leading-snug transition-colors ${
                  item.level === 3 ? 'pl-4 text-xs' : ''
                } ${
                  isActive ? 'text-orange-400 font-semibold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {item.text}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
