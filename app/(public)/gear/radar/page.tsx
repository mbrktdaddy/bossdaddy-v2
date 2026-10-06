import Link from 'next/link'
import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/anon'
import { getRadarArchive, radarAnchorId, radarOutcome, type RadarItem } from '@/lib/products/radar'
import { RadarCard } from '@/components/radar/RadarCard'
import PageHeader from '@/components/PageHeader'
import SectionHeader from '@/components/SectionHeader'
import FtcDisclosure from '@/components/FtcDisclosure'
import { EmptyState } from '@/components/ui/EmptyState'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata, SITE_URL } from '@/lib/og'

export const revalidate = 3600
// The "released by now" filter reads the current date; pinned static for the
// same reason as /gear. Product edits and votes purge it (lib/revalidate.ts).
export const dynamic = 'force-static'

export const metadata: Metadata = buildSocialMetadata({
  title: "On the Radar — Gear That Caught Boss Daddy's Eye",
  ogTitle: LABELS.radar.full,
  description: "New gear that caught Boss Daddy's eye, with his honest take on each, and where it went next: onto the test bench, into a review, or passed on.",
  path: '/gear/radar',
  siteUrl: SITE_URL,
  type: 'site',
  ogType: 'website',
})

function RadarGrid({ items }: { items: RadarItem[] }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {items.map((item) => (
        // Anchored so the account page's follow list can jump to the card.
        <li key={item.id} id={radarAnchorId(item.slug)} className="scroll-mt-24">
          <RadarCard item={item} />
        </li>
      ))}
    </ul>
  )
}

// The On the Radar archive: everything that has been on the Radar and is still
// public. Live items carry the vote; the rest show where they went. Passing on
// something in public, with the reason, is part of the point (plan).
// No per-item pages: a Radar item that earns more graduates to the Bench.
export default async function RadarArchivePage() {
  const items = await getRadarArchive(createAnonClient())
  const live    = items.filter((item) => radarOutcome(item)?.kind === 'live')
  const movedOn = items.filter((item) => radarOutcome(item)?.kind !== 'live')

  return (
    <>
      <PageHeader
        eyebrow="Gear"
        title={LABELS.radar.full}
        deck="New gear that caught my eye, with my honest take on each. Want one tested? Say the word. Once something moves on, you'll see where it went: onto the bench, into a review, or passed on — with the reason."
      />
      <div className="max-w-6xl mx-auto px-6 py-12">
        {items.length === 0 ? (
          <EmptyState
            title="Nothing on the radar yet."
            body="When something new catches my eye, it lands here first."
          />
        ) : (
          <>
            {/* Only live cards carry buy links, so the disclosure is needed only then. */}
            {live.some((item) => item.affiliate_url) && <FtcDisclosure />}

            <section className="mb-16">
              <SectionHeader
                label="Live"
                heading="Want Me to Test One?"
                sub="Vote for the ones you want tested."
              />
              {live.length > 0 ? (
                <RadarGrid items={live} />
              ) : (
                <p className="rounded-xl border border-soft bg-surface px-5 py-4 text-sm text-prose-muted">
                  Nothing on the radar right now. When something new catches my eye, it lands here first.
                </p>
              )}
            </section>

            {movedOn.length > 0 && (
              <section className="mb-16">
                <SectionHeader
                  label="Moved On"
                  heading="Where They Went"
                  sub="Onto the bench, into a review, or passed on, with the reason."
                />
                <RadarGrid items={movedOn} />
              </section>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/gear"
            className="inline-flex items-center min-h-[44px] gap-2 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
          >
            ← Back to {LABELS.gear.short}
          </Link>
        </div>
      </div>
    </>
  )
}
