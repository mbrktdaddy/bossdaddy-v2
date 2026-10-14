import Link from 'next/link'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import { createAnonClient } from '@/lib/supabase/anon'
import { OCCASIONS, OCCASION_GROUPS, getSeasonalOccasions } from '@/lib/gift-occasions'
import type { SeasonalGift } from '@/lib/collections/seasonal-gifts'
import OccasionTiles from '@/components/collections/OccasionTiles'
import CollectionListingHeader from '@/components/collections/CollectionListingHeader'
import EditorialHeader from '@/components/EditorialHeader'
import { NewsletterSignup } from '@/components/newsletter/NewsletterSignup'

export const revalidate = 60

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: 'Gift Guides — Dad-Picked Gifts | Boss Daddy',
    description: 'Honest gift guides for every holiday and occasion — Father\'s Day, Christmas, birthdays, weddings, and more. Every pick chosen by a real dad — no paid placements.',
    path: '/gifts',
    siteUrl,
    ogTitle: 'Gift Guides — Boss Daddy Life',
    type: 'site',
    ogType: 'website',
  })
}

export default async function GiftsIndexPage() {
  const supabase = createAnonClient()

  // Every published gift guide, newest first. A guide only counts as LIVE once
  // it holds at least one pick — an empty collection still routes to the
  // detail page's "Coming soon" state, which no shelf should link to. The item
  // count rides inline to avoid an N+1 per occasion.
  const { data: rows } = await supabase
    .from('collections')
    .select('occasion, hero_image_url, published_at, collection_items(count)')
    .eq('collection_type', 'gift_guide')
    .eq('is_visible', true)
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })

  // Newest published collection wins per occasion (rows arrive newest first),
  // mirroring the /gifts/[occasion] page's selection.
  const liveByOccasion = new Map<string, { heroImageUrl: string | null }>()
  for (const r of rows ?? []) {
    const count = Array.isArray(r.collection_items) ? (r.collection_items[0]?.count ?? 0) : 0
    if (r.occasion && count > 0 && !liveByOccasion.has(r.occasion)) {
      liveByOccasion.set(r.occasion, { heroImageUrl: r.hero_image_url ?? null })
    }
  }

  // The live shelf: in-season occasions first, in the order /gear and the
  // homepage band use, then everything else in taxonomy order (stable sort).
  const seasonalOrder = getSeasonalOccasions().map((o) => o.value)
  const rank = (value: string) => {
    const i = seasonalOrder.indexOf(value as (typeof seasonalOrder)[number])
    return i === -1 ? seasonalOrder.length : i
  }
  const live: SeasonalGift[] = OCCASIONS
    .filter((occ) => liveByOccasion.has(occ.value))
    .sort((a, b) => rank(a.value) - rank(b.value))
    .map((occ) => ({ occ, heroImageUrl: liveByOccasion.get(occ.value)?.heroImageUrl ?? null }))

  return (
    <>
      <CollectionListingHeader tab="gifts" />
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        {/* The guides that exist ARE the page. Until 2026-10-14 this was a
            30-tile occasion grid with a "Coming soon" stamp on every unwritten
            one — with a single live guide that read as 29 dead-ends under a
            top-level nav link. Now the live shelf leads (the same tiles /gear
            and the homepage band use) and the calendar is a directory under it. */}
        {live.length > 0 && (
          <section className="mb-14">
            <EditorialHeader eyebrow="Gift guides" title="Ready now" />
            <OccasionTiles gifts={live} />
          </section>
        )}

        {/* The occasion directory. Every /gifts/[slug] URL stays linked — they
            compound SEO across years — as a quiet grouped list rather than a
            tile each. A live occasion is bold with the accent dot; the rest
            read as the calendar, not as missing content. */}
        <section className="mb-14">
          <EditorialHeader eyebrow="Every occasion" title="On the calendar" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
            {OCCASION_GROUPS.map((group) => (
              <div key={group.id}>
                <h3 className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{group.label}</h3>
                <ul>
                  {OCCASIONS.filter((o) => o.group === group.id).map((occ) => {
                    const isLive = liveByOccasion.has(occ.value)
                    return (
                      <li key={occ.value}>
                        <Link
                          href={`/gifts/${occ.slug}`}
                          className={`flex items-center gap-2 min-h-11 text-sm transition-colors hover:text-accent ${
                            isLive ? 'font-extrabold text-prose' : 'text-prose-muted'
                          }`}
                        >
                          {occ.label}
                          {isLive && (
                            <>
                              <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-accent" />
                              <span className="sr-only">(live)</span>
                            </>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter pitch — the form itself, in place. This used to link to
            `/#newsletter`, an id nothing on the homepage carried (B3), so "Get on
            the list" dropped people at the top of the homepage. intent="notify"
            tags `notify:gifts:season` — it's a heads-up before each holiday, not
            the weekly digest, so it must not enrol anyone in that (B5). */}
        <NewsletterSignup
          variant="card"
          intent="notify"
          topic="gifts:season"
          eyebrow="Gift alerts"
          headingAs="h3"
          heading="New gift guides drop with the seasons"
          body="Get an email when a new gift guide drops — fresh picks before each major holiday."
          className="mt-16 max-w-2xl mx-auto"
        />
      </div>
    </>
  )
}
