import Link from 'next/link'

export interface LatestItem {
  /** Content-type role label — "Guide" or "Review". Never the category: the rail's
   *  job is "what's new here", and type is the distinction that isn't already in
   *  the headline. */
  kind: string
  title: string
  href: string
  published_at: string | null
}

/**
 * Text-only recency index. The lightest tier on the homepage and the only one
 * with no images at all — which is exactly why it earns its place: it breaks the
 * run of image cards, and it works identically whether the library holds nine
 * pieces or nine hundred.
 *
 * Rendered as a bordered surface panel rather than naked text. On a near-black
 * canvas an unbordered text column beside a large card reads as unfinished
 * scaffolding; the panel is how this design system makes elevation (borders and
 * raised surfaces, never shadows — see brand-guide §2).
 *
 * Items are NOT deduped against the sections below. The rail is an index, so a
 * guide appearing both here and in the Library is correct, not a bug — resist
 * "fixing" it.
 */
export default function LatestRail({ items, allHref }: { items: LatestItem[]; allHref?: string }) {
  if (items.length === 0) return null

  return (
    /* `h-full`, not `self-start`: the panel matches the row height so its border
       frames the whole column. With `self-start` it stopped at its last item, which
       put the void under whichever column happened to be shorter. */
    <aside className="bg-surface border border-soft rounded-2xl p-6 lg:p-7 h-full">
      <span aria-hidden className="block h-px w-6 bg-accent mb-4" />
      <h3 className="font-editorial-display font-semibold text-prose text-xl leading-tight tracking-tight">
        The latest
      </h3>

      <ul className="mt-4 divide-y divide-soft">
        {items.map((it) => {
          const date = it.published_at
            ? new Date(it.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
            : null
          return (
            <li key={it.href}>
              <Link href={it.href} className="group block py-3.5">
                <p className="text-[15px] font-bold text-prose leading-snug group-hover:text-accent transition-colors">
                  {it.title}
                </p>
                <p className="mt-1 flex items-center gap-2 text-[11px] text-prose-faint">
                  <span className="font-bold uppercase tracking-[0.14em] text-eyebrow">{it.kind}</span>
                  {date && (
                    <>
                      <span aria-hidden className="w-1 h-1 rounded-full bg-prose-faint/50" />
                      <span>{date}</span>
                    </>
                  )}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Optional, and currently omitted on the homepage: the rail is mixed-type
          and there's no mixed-type index route to point at (/guides and /reviews
          are each half the promise). Wire this the day a combined /latest exists. */}
      {allHref && (
        <Link
          href={allHref}
          className="mt-5 pt-4 border-t border-soft block text-[11px] font-bold uppercase tracking-[0.1em] text-accent hover:text-accent-hover transition-colors"
        >
          See everything →
        </Link>
      )}
    </aside>
  )
}
