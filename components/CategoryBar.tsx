'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics'
import { CATEGORIES } from '@/lib/categories'
import { LABELS } from '@/lib/labels'

/**
 * The topics row under the masthead — every width since Hard Goods (A2, the
 * folded masthead, 2026-10-14). On a phone it is the scroller that replaced
 * the brand band (the band under the black masthead read as "two header nav
 * bands"); on lg+ it is the Wirecutter / Men's Health category strip with
 * hairline dividers. White, not a dark zone: the masthead's 4px orange rule is
 * the edge, and the row sits under it on the page.
 *
 * Since nav-ia-plan I-7 (2026-10-14) this row IS the topics nav — the
 * masthead's Topics ▾ menu is gone. It is a lateral-browsing aid, not the
 * primary nav (that's the bottom strip; Explore is the door to every topic),
 * so position bias toward the first four labels is expected, not a defect.
 *
 * Rendered by the public layout right AFTER <Header>, not inside it, so the
 * masthead stays sticky and this row scrolls away with the page.
 *
 * The scroller owns the overflow and the gutter padding lives INSIDE it (the
 * CLAUDE.md horizontal-scroll rule) so the strip can never bleed to page level.
 *
 * EDGE FADES (phone/tablet): the scrollbar is hidden, so without them the only
 * hint that the row scrolls is a label happening to be cut at the gutter. Each
 * fade hides at its own end of travel so the first and last topics are never
 * read through a veil. Scroll position is written straight to data attributes
 * and the fades key off them with `peer-data-*` — no React state, because a
 * scroll offset is a visual fact, not app state, and a re-render per scroll
 * event is waste. lg+ centres the row and never scrolls, so the fades hide.
 */
export default function CategoryBar() {
  const pathname = usePathname()
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const sync = () => {
      el.dataset.atStart = String(el.scrollLeft <= 1)
      el.dataset.atEnd = String(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', sync)
      ro.disconnect()
    }
  }, [])

  return (
    <nav aria-label={LABELS.topics.short} className="bg-background border-b border-soft">
      <div className="relative">
        {/* Server-rendered as "at the start, not at the end" — the right fade
            shows on first paint, before hydration; `sync` corrects the rest. */}
        <div ref={scrollerRef} data-at-start="true" data-at-end="false" className="peer overflow-x-auto scrollbar-hide">
          {/* Phone: left-packed scroller, first label flush with the gutter.
              lg+: the group is CENTRED in the container with dividers between
              cells (he read the left-packed desktop row as misaligned). */}
          <ul className="flex w-max min-w-full max-w-6xl mx-auto px-6 h-11 items-stretch lg:justify-center">
            {CATEGORIES.map((c, i) => {
              const href = `/category/${c.slug}`
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <li key={c.slug} className="flex lg:border-r lg:border-soft lg:last:border-r-0">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    /* The reader evidence the moratorium asks for (brand-guide
                       §10.1): which topics the row actually sends people to, by
                       position, so "do phone readers use the scroller / reach
                       labels 5–10" is a dashboard query, not a feeling. Slug +
                       position only — nothing about the reader. */
                    onClick={() => track('topics_row', { slug: c.slug, position: i + 1 })}
                    className={`flex items-center ${i === 0 ? 'pr-3 lg:px-3.5' : 'px-3 lg:px-3.5'} font-display font-extrabold text-[11px] uppercase tracking-[0.12em] whitespace-nowrap text-prose border-b-[3px] -mb-px transition-colors ${
                      active ? 'border-accent' : 'border-transparent hover:border-accent'
                    }`}
                  >
                    {c.shortLabel}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background to-transparent transition-opacity lg:hidden peer-data-[at-start=true]:opacity-0"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent transition-opacity lg:hidden peer-data-[at-end=true]:opacity-0"
        />
      </div>
    </nav>
  )
}
