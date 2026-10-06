import Link from 'next/link'
import SectionHeader from '@/components/SectionHeader'
import FtcDisclosure from '@/components/FtcDisclosure'
import { RadarCard } from './RadarCard'
import { LABELS } from '@/lib/labels'
import type { RadarItem } from '@/lib/products/radar'

interface Props {
  /** Live Radar items, newest first (getLiveRadar). */
  items: RadarItem[]
  sub: string
  /** Shown in place of the cards when nothing is live. */
  emptyText: string
  className?: string
}

const ARCHIVE = { label: 'Everything on the radar', href: '/gear/radar' }

// Phones show the newest 3 so a text-heavy lane doesn't bury Boss Approved;
// the rest appear from `sm` up, and the archive link covers the remainder.
const MOBILE_COUNT = 3

/**
 * The On the Radar lane on /gear and each /gear/category page.
 *
 * Always rendered, empty included (the operator's uniformity rule): with
 * nothing live it collapses to one slim line, like the gift-guide block on
 * /gear, instead of disappearing. Its buy links are the page's only affiliate
 * links, so the FTC line sits here, above the first card.
 */
export function RadarLane({ items, sub, emptyText, className = '' }: Props) {
  return (
    <section id="on-the-radar" className={className}>
      <SectionHeader label="Caught My Eye" heading={LABELS.radar.full} sub={sub} right={ARCHIVE} />

      {items.length === 0 ? (
        <p className="rounded-xl border border-soft bg-surface px-5 py-4 text-sm text-prose-muted">{emptyText}</p>
      ) : (
        <>
          {items.some((item) => item.affiliate_url) && <FtcDisclosure />}
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item, i) => (
              <li key={item.id} className={i >= MOBILE_COUNT ? 'hidden sm:block' : undefined}>
                <RadarCard item={item} />
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 sm:hidden text-right">
        <Link
          href={ARCHIVE.href}
          className="inline-flex items-center min-h-[44px] text-xs text-accent-text-soft hover:text-accent font-semibold transition-colors"
        >
          {ARCHIVE.label} →
        </Link>
      </div>
    </section>
  )
}
