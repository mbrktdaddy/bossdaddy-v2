import type { Metadata } from 'next'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import CollectionListingHeader from '@/components/collections/CollectionListingHeader'
import CollectionGrid from '@/components/collections/CollectionGrid'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 60

const TITLE = `${LABELS.picks.full} — Dad-Picked Gear Roundups | Boss Daddy`
const DESCRIPTION = 'Dad-picked best-of lists and category roundups. Every pick independently chosen by Boss Daddy — no paid placements.'

export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: '/picks' },
  openGraph: {
    ...OG_SITE,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: ogImageUrl({ title: LABELS.picks.full, type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function PicksIndexPage({ searchParams }: Props) {
  const { cat } = await searchParams
  return (
    <>
      <CollectionListingHeader tab="picks" />
      <div className="max-w-6xl mx-auto px-6 pt-8 pb-12">
        <CollectionGrid tab="picks" cat={cat ?? null} />
        <div className="mt-16">
          <BenchStrip ctaText="See all on the bench" />
        </div>
      </div>
    </>
  )
}
