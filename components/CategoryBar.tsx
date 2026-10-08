import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

/**
 * Desktop topic row under the masthead — the visible category strip every
 * major publication carries (Wirecutter, Gear Patrol, Men's Health). Phones
 * keep the bottom nav + the Topics menu, so this is `lg:` and up only.
 *
 * Rendered by the public layout right AFTER <Header>, not inside it, so the
 * masthead stays sticky and this row scrolls away with the page — the
 * Wirecutter behaviour. A dark ZONE like the rest of the chrome.
 *
 * Short labels so all ten fit on one line at lg without a scroll strip
 * (a scroll strip inside a padded container is the bleed bug CLAUDE.md warns
 * about, and a wrapping row would push the brand band down).
 */
export default function CategoryBar() {
  return (
    <nav data-theme="dark" aria-label="Topics" className="hidden lg:block bg-chrome border-b border-soft">
      <div className="max-w-6xl mx-auto px-6">
        <ul className="flex items-center justify-between -mx-2">
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="block px-2 py-2.5 text-[13px] font-semibold text-prose-muted hover:text-prose whitespace-nowrap transition-colors"
              >
                {c.shortLabel}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
