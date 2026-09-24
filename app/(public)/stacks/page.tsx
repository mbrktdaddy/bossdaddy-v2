import type { Metadata } from 'next'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import VaultShell from '@/components/vault/VaultShell'
import VaultGrid from '@/components/vault/VaultGrid'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 60

export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  title: { absolute: 'Stacks — Dad-Tested Kits | Boss Daddy' },
  description: 'Curated kits for a goal. The full setup for newborn nights, weekend cookouts, garage builds, and more.',
  alternates: { canonical: '/stacks' },
  openGraph: {
    ...OG_SITE,
    title: 'Stacks — Dad-Tested Kits | Boss Daddy',
    description: 'Curated kits for a goal. The full setup for newborn nights, weekend cookouts, garage builds, and more.',
    images: [{ url: ogImageUrl({ title: 'Dad-Tested Stacks & Kits', type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE },
}

interface Props { searchParams: Promise<{ cat?: string }> }

export default async function StacksIndexPage({ searchParams }: Props) {
  const { cat } = await searchParams
  return (
    <VaultShell active="stacks">
      <VaultGrid tab="stacks" cat={cat ?? null} />
      <div className="mt-16">
        <BenchStrip ctaText="See all on the bench" />
      </div>
    </VaultShell>
  )
}
