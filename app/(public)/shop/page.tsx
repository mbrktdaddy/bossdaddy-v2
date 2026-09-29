import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import type { Metadata } from 'next'
import { MerchGrid } from './_components/MerchGrid'

export const revalidate = 3600

export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  title: { absolute: 'The Boss Daddy Shop — Merch Made by a Real Dad' },
  description: 'Boss Daddy branded apparel, drinkware and accessories. Built for the dads who get it done.',
  openGraph: {
    ...OG_SITE,
    title: 'The Boss Daddy Shop — Boss Daddy Life',
    description: 'Branded apparel, drinkware and accessories, made by a real dad.',
    images: [{ url: ogImageUrl({ title: 'The Boss Daddy Shop', type: 'site' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE, title: 'The Boss Daddy Shop — Boss Daddy Life' },
  alternates: { canonical: '/shop' },
}

// The store, split out of /gear on 2026-09-29 so "Gear" means tested gear only.
// Static: MerchGrid reads through the cookie-free anon client (audit H3).
export default function ShopPage() {
  return (
    <>
      <PageHeader
        eyebrow="Made by Boss Daddy"
        title={LABELS.shop.full}
        deck={LABELS.shop.tagline}
      />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <MerchGrid />

        <p className="mt-12 text-sm text-prose-muted">
          Looking for the gear I&apos;ve tested and recommend?{' '}
          <Link href="/gear" className="text-accent-text font-semibold hover:text-accent-text-soft transition-colors">
            See {LABELS.gear.short} →
          </Link>
        </p>
      </div>
    </>
  )
}
