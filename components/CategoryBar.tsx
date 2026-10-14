'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
 * Rendered by the public layout right AFTER <Header>, not inside it, so the
 * masthead stays sticky and this row scrolls away with the page.
 *
 * The scroller owns the overflow and the gutter padding lives INSIDE it (the
 * CLAUDE.md horizontal-scroll rule) so the strip can never bleed to page level.
 * A client component only for `usePathname` — no data, static labels.
 */
export default function CategoryBar() {
  const pathname = usePathname()
  return (
    <nav aria-label={LABELS.topics.short} className="bg-background border-b border-soft">
      <div className="overflow-x-auto scrollbar-hide">
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
    </nav>
  )
}
