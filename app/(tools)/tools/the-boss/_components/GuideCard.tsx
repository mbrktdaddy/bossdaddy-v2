import Link from 'next/link'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import type { GuideBlock } from '@/lib/boss/types'

// First-class guide/content card for The Boss. Content is the PRIMARY grounding
// surface (north star), so a matched guide gets a real card — category eyebrow +
// title + one-line "why this helps" + read-time — not the old thin link chip.
// Rendered entirely from search_guides' structured data (never parsed from prose).
export default function GuideCard({ c }: { c: GuideBlock }) {
  const cat = c.category ? getCategoryBySlug(c.category) : null
  return (
    <Link
      href={c.url}
      className="group block border border-soft rounded-xl p-3 bg-surface hover:border-accent transition-colors"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-eyebrow mb-1">
        {cat ? (
          <>
            <CategoryIcon slug={cat.slug} className="w-3 h-3 text-accent-text" />
            {cat.label}
          </>
        ) : (
          'Guide'
        )}
      </div>
      <p className="font-semibold text-prose group-hover:text-accent leading-snug transition-colors">{c.title}</p>
      {c.excerpt && <p className="mt-1 text-[13px] text-prose-muted leading-snug line-clamp-2">{c.excerpt}</p>}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-prose-faint">
        {typeof c.readingMinutes === 'number' && c.readingMinutes > 0 && <span>{c.readingMinutes} min read</span>}
        <span className="text-accent font-semibold">Read guide →</span>
      </div>
    </Link>
  )
}
