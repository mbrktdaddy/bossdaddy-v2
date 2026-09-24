import type { Metadata } from 'next'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import VaultShell from '@/components/vault/VaultShell'
import VaultGrid from '@/components/vault/VaultGrid'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 60

export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  title: { absolute: 'Comparisons — Head-to-Head Reviews | Boss Daddy' },
  description: 'Dad-tested head-to-head matchups. Real products, real scores, one clear winner per dimension.',
  alternates: { canonical: '/comparisons' },
  openGraph: {
    ...OG_SITE,
    title: 'Comparisons | Boss Daddy',
    description: 'Dad-tested head-to-head matchups. Real products, real scores, one clear winner per dimension.',
    images: [{ url: ogImageUrl({ title: 'Head-to-Head Comparisons', type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function ComparisonsIndexPage({ searchParams }: Props) {
  const { cat } = await searchParams
  return (
    <VaultShell active="comparisons">
      <VaultGrid tab="comparisons" cat={cat ?? null} />
      <div className="mt-16">
        <BenchStrip ctaText="See all on the bench" />
      </div>
    </VaultShell>
  )
}
