import Link from 'next/link'
import Image from 'next/image'
import OccasionIcon from '@/components/OccasionIcon'
import type { SeasonalGift } from '@/lib/collections/seasonal-gifts'

/**
 * Occasion tiles for a shelf of live gift guides — a horizontal strip on phones,
 * a three-up grid from `sm`. One component for the /gear hub's Shop by Occasion
 * section and the homepage's gift-season band (Phase I-6); it was inline on
 * /gear before the band needed the same tiles.
 *
 * Split into a `sm:hidden` strip and a `hidden sm:grid` grid on purpose — never
 * `overflow-x-auto` inside a padded container (CLAUDE.md). The strip's `-mx-6
 * px-6` breaks out to the container edge and restores the inset inside.
 */
export default function OccasionTiles({ gifts }: { gifts: SeasonalGift[] }) {
  if (gifts.length === 0) return null
  return (
    <>
      {/* Mobile: horizontal scroll */}
      <div className="sm:hidden flex gap-3 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
        {gifts.map(({ occ, heroImageUrl }) => (
          <Link
            key={occ.slug}
            href={`/gifts/${occ.slug}`}
            className="shrink-0 w-40 rounded-xl overflow-hidden bg-surface border border-soft hover:border-accent-border/40 hover:-translate-y-1 transition-all"
          >
            <div className="relative w-full h-24 bg-surface-raised">
              {heroImageUrl ? (
                <Image src={heroImageUrl} alt={occ.label} fill className="object-cover" sizes="160px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-9 h-9 text-accent-text/60" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 to-transparent" />
              <p className="absolute bottom-2 left-3 right-3 text-white text-xs font-black leading-tight">{occ.label}</p>
            </div>
            <p className="px-3 py-2 text-xs text-prose-muted line-clamp-2 leading-relaxed">{occ.shortBlurb}</p>
          </Link>
        ))}
      </div>

      {/* Desktop: 3-col grid */}
      <div className="hidden sm:grid grid-cols-3 gap-4">
        {gifts.map(({ occ, heroImageUrl }) => (
          <Link
            key={occ.slug}
            href={`/gifts/${occ.slug}`}
            className="group relative rounded-xl overflow-hidden border border-soft hover:border-accent-border/40 hover:-translate-y-1 transition-all"
          >
            <div className="relative w-full h-36 bg-surface-raised">
              {heroImageUrl ? (
                <Image src={heroImageUrl} alt={occ.label} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 33vw, 320px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><OccasionIcon value={occ.value} className="w-12 h-12 text-accent-text/60" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/60 via-zinc-900/20 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-black text-sm leading-tight mb-0.5">{occ.label}</p>
              <p className="text-zinc-200 text-xs line-clamp-1">{occ.shortBlurb}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  )
}
