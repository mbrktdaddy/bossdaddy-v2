import Link from 'next/link'
import ContentRow from '@/components/ContentRow'
import LeadCard from '@/components/LeadCard'

/** One entry in a topic block, already normalized by the caller. */
export interface TopicItem {
  id: string
  href: string
  eyebrow: string
  headline: string
  /** Small line under the headline in row form; ignored on the lead card. */
  sub?: string | null
  excerpt?: string | null
  meta?: string | null
  imageUrl: string | null
  rating?: number | null
}

interface Props {
  label: string
  /** "View all" target — a category route. */
  viewAllHref: string
  /** Optional total for the "View all" label. Listing pages pass it (the number is
   *  information there); the homepage omits it (there it's a scale claim, and a thin
   *  number is worse than none). */
  viewAllCount?: number
  /** Optional one-line category description. Listing pages only. */
  description?: string | null
  items: TopicItem[]
  cta: string
  on?: 'background' | 'surface'
  /**
   * Position of this block within its run, 0-based. Drives the alternating
   * handedness — even blocks lead-left, odd blocks lead-right. Deliberately an
   * index rather than a `flip` boolean: the rule lives here, so no call site can
   * fall out of step with the others.
   */
  index?: number
}

/**
 * A category rendered as its own module: lead card + compact rows. Wirecutter's
 * dominant homepage module, and now the single implementation behind all three
 * per-category directories — the homepage Library, `/guides`, and `/reviews`.
 * Those last two were structural twins with hand-rolled copies of this markup.
 *
 * ONE SHAPE, ON PURPOSE. A category with a single item renders the lead card with
 * an empty row column, and that's accepted — the categories are being filled in,
 * and a uniform grid of modules is worth more than a tidy empty state. Do not
 * "fix" thin blocks by hiding them or by swapping in a different layout below some
 * count; both were built and both were rejected for breaking the uniformity.
 *
 * Content-kind agnostic by design: callers map guides or reviews into `TopicItem`.
 * A `guide | review` union here would drag both content types into a component
 * whose only real job is the module's shape.
 */
export default function TopicBlock({
  label, viewAllHref, viewAllCount, description, items, cta, on = 'surface', index = 0,
}: Props) {
  const [lead, ...rows] = items
  if (!lead) return null

  // Alternating handedness (settled 2026-08-03): modules run serpentine down the
  // page — even blocks lead-left, odd blocks lead-right, rows mirroring with them.
  //
  // This is a deliberate DEPARTURE from Wirecutter, which runs all nine of its
  // lead+rows modules the same way round so the lead card holds one vertical scan
  // line. Judged live against a fixed-handedness build across all three surfaces
  // and the serpentine won. Don't "restore" uniform handedness as a consistency fix.
  const flip = index % 2 === 1

  return (
    <section className="mt-12 pt-10 border-t border-soft">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <span aria-hidden className="block h-px w-6 bg-accent mb-3" />
          <h3 className="font-editorial-display font-semibold text-prose text-2xl md:text-[1.75rem] leading-tight tracking-tight">
            {label}
          </h3>
          {description && (
            <p className="text-sm text-prose-faint mt-1.5 line-clamp-1">{description}</p>
          )}
        </div>
        <Link
          href={viewAllHref}
          className="shrink-0 whitespace-nowrap text-[11px] sm:text-xs font-bold uppercase tracking-[0.08em] text-accent hover:text-accent-hover transition-colors"
        >
          {viewAllCount ? `View all ${viewAllCount}` : `View all in ${label}`} →
        </Link>
      </div>

      {/* Ordering is done with `lg:order-*`, NOT by reordering the children. DOM
          order stays lead-then-rows so the single-column mobile stack always opens
          on the lead card, whichever way round the desktop module runs. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start">
        <div className={flip ? 'lg:order-2' : undefined}>
          <LeadCard
            href={lead.href}
            title={lead.headline}
            imageUrl={lead.imageUrl}
            eyebrow={lead.eyebrow}
            excerpt={lead.excerpt}
            meta={lead.meta}
            cta={cta}
            on={on}
          />
        </div>
        {rows.length > 0 && (
          <div className={`flex flex-col lg:-mt-5 ${flip ? 'lg:order-1' : ''}`}>
            {rows.map((it, i) => (
              <ContentRow
                key={it.id}
                href={it.href}
                eyebrow={it.eyebrow}
                headline={it.headline}
                sub={it.sub}
                excerpt={it.excerpt}
                meta={it.meta}
                imageUrl={it.imageUrl}
                imageAlt={it.headline}
                rating={it.rating}
                isLast={i === rows.length - 1}
                flip={flip}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
