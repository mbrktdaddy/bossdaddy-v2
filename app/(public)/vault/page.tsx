import type { Metadata } from 'next'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import VaultShell from '@/components/vault/VaultShell'
import VaultGrid from '@/components/vault/VaultGrid'
import OffTheBench from '@/components/OffTheBench'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 300

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: `${LABELS.vault.full} — Comparisons, Best-Of Lists, Stacks & Gift Guides | Boss Daddy`,
    description: 'The Vault — every Boss Daddy comparison, best-of list, stack, and gift guide in one place. Real-tested picks, head-to-head scorecards, and curated kits for boss dads.',
    path: '/vault',
    siteUrl,
    ogTitle: `${LABELS.vault.full} — Boss Daddy`,
    type: 'site',
    ogType: 'website',
  })
}

interface Props {
  searchParams: Promise<{ cat?: string; tab?: string }>
}

export default async function VaultLandingPage({ searchParams }: Props) {
  const { cat } = await searchParams

  return (
    <VaultShell active="all">
      <VaultGrid tab="all" cat={cat ?? null} />

      {/* The back of the testing funnel (just graduated), then the front (vote next). */}
      <OffTheBench className="mt-16" />
      <div className="mt-16">
        <BenchStrip ctaText="See what's coming next" />
      </div>
    </VaultShell>
  )
}
