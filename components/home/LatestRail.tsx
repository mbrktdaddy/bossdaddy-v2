import Link from 'next/link'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'
import { formatPublished, type LatestItem } from '@/lib/latest'

// The item shape lives in lib/latest.ts (shared with /explore's index); re-exported
// so existing imports keep working.
export type { LatestItem }

/**
 * Text-only recency index. The lightest tier on the homepage and the only one
 * with no images at all — which is exactly why it earns its place: it breaks the
 * run of image cards, and it works identically whether the library holds nine
 * pieces or nine hundred.
 *
 * Rendered as a NAKED list with hairline dividers — a newspaper sidebar, not a
 * panel (light-editorial pass, 2026-10-08). It used to be a bordered surface
 * panel on desktop and a horizontal strip of bordered cards on phones; on a
 * white canvas both read as UI chrome. One DOM, one direction at every width:
 * six short rows (~360px on a phone) is a list, not a dead scroll.
 *
 * Items are NOT deduped against the sections below. The rail is an index, so a
 * guide appearing both here and in the Library is correct, not a bug — resist
 * "fixing" it.
 */
export default function LatestRail({ items, allHref }: { items: LatestItem[]; allHref?: string }) {
  if (items.length === 0) return null

  return (
    <aside className="lg:h-full">
      <div className="pb-3 border-b-[3px] border-chrome">
        <LabelBlock>Newest first</LabelBlock>
        <h3 className="mt-2.5 font-black text-prose uppercase text-xl leading-tight tracking-[-0.01em]">
          The latest
        </h3>
      </div>

      <ul className="flex flex-col divide-y divide-soft">
        {items.map((it) => {
          const date = formatPublished(it.published_at, 'short')
          return (
            <li key={it.href}>
              <Link href={it.href} className="group block py-3.5">
                <p className="font-display font-extrabold text-[15px] text-prose leading-snug tracking-tight group-hover:text-accent transition-colors line-clamp-2">
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
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'mt-5' })}
        >
          See everything →
        </Link>
      )}
    </aside>
  )
}
