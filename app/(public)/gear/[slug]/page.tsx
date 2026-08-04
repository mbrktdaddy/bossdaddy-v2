import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { formatPrice, getMerchDisplayImage } from '@/lib/merch'
import MerchProductView from './_components/MerchProductView'
import { buildSocialMetadata, toAbsoluteUrl } from '@/lib/og'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

// Prerender the public merch catalog so these pages are static (audit H3).
// Same visibility filter the page body uses; anon client keeps it cookie-free.
export async function generateStaticParams() {
  const supabase = createAnonClient()
  const { data } = await supabase
    .from('merch')
    .select('slug')
    .in('status', ['available', 'coming_soon'])
    .is('archived_at', null)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAnonClient()
  const { data } = await supabase
    // updated_at feeds the card's `v=` cache-buster. Without it every merch card
    // is pinned at `v=<template>-0` forever, and since /og-card is cached
    // `immutable` for a year, swapping a product mockup would never refresh the
    // preview. Every other content type already passes its row timestamp.
    .from('merch').select('name, description, image_url, default_image_url, updated_at').eq('slug', slug).maybeSingle()
  if (!data) return {}
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  // Route through buildSocialMetadata like every other public page. The bespoke
  // block this replaced was broken three ways: it prefixed siteUrl onto an
  // ALREADY-ABSOLUTE Printful URL (emitting the nonexistent host
  // "www.bossdaddylife.comhttps//files.cdn.printful.com/…", so every merch card
  // image 404'd), it declared 1200×630 on a square product mockup, and its
  // `twitter: { card }` object REPLACED the layout's — dropping the @bossdaddylife
  // site/creator handles (Next replaces `twitter`/`openGraph`, never deep-merges).
  // toAbsoluteUrl passes absolute URLs through and only prefixes relative ones.
  return buildSocialMetadata({
    // The name-based title already carries the brand — buildSocialMetadata emits
    // it as `absolute`, avoiding "… — Boss Daddy Life | Boss Daddy".
    title: `${data.name} — Boss Daddy Life`,
    ogTitle: data.name,
    description: data.description,
    path: `/gear/${slug}`,
    siteUrl,
    // 'site' = no content-type badge. Merch is neither a review nor an article,
    // and the old `type: 'guide'` stamped a wrong "ARTICLE" badge on the card.
    type: 'site',
    ogType: 'website',
    cta: 'Shop the Gear',
    heroUrl: toAbsoluteUrl(data.image_url ?? data.default_image_url, siteUrl),
    // Product mockups are square; 'cover' zooms so far into a 1200×630 frame that
    // the product is cut off. Letterbox the whole thing onto the card canvas.
    fit: 'contain',
    updatedAt: data.updated_at,
  })
}

export default async function MerchDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAnonClient()

  const { data: merch } = await supabase
    .from('merch')
    .select('id, slug, name, description, image_url, default_image_url, images, enabled_images, status, currency')
    .eq('slug', slug)
    .in('status', ['available', 'coming_soon'])
    .is('archived_at', null)
    .maybeSingle()

  if (!merch) notFound()

  const { data: variantsData } = await supabase
    .from('merch_variants')
    .select('id, size, color, retail_price_cents, image_url, in_stock, position')
    .eq('merch_id', merch.id)
    .order('position', { ascending: true })

  const variants = variantsData ?? []
  const isAvailable = merch.status === 'available'
  const fallbackImage = getMerchDisplayImage(merch as Parameters<typeof getMerchDisplayImage>[0])
  const m = merch as { images?: string[]; enabled_images?: string[] }
  // enabled_images = admin-curated subset; images = full synced set; fallback = thumbnail
  const galleryImages: string[] =
    (m.enabled_images?.length ? m.enabled_images : null) ??
    (m.images?.length ? m.images : null) ??
    (fallbackImage ? [fallbackImage] : [])

  const prices = [...new Set(variants.map(v => v.retail_price_cents))]
  const priceDisplay = prices.length === 0
    ? '—'
    : prices.length === 1
    ? formatPrice(prices[0])
    : `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <Link
        href="/gear"
        className="inline-flex items-center gap-1.5 text-sm text-prose-faint hover:text-accent-text-soft transition-colors mb-8"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Gear
      </Link>

      <MerchProductView
        galleryImages={galleryImages}
        variants={variants}
        name={merch.name}
        priceDisplay={priceDisplay}
        description={merch.description}
        isAvailable={isAvailable}
      />
    </div>
  )
}
