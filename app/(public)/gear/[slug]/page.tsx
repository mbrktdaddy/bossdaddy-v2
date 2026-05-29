import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatPrice, getMerchDisplayImage } from '@/lib/merch'
import AddToCartForm from './_components/AddToCartForm'
import { MerchImageGallery } from '@/components/MerchImageGallery'
import type { Metadata } from 'next'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('merch').select('name, description, image_url, default_image_url').eq('slug', slug).maybeSingle()
  if (!data) return {}
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const ogImage = (data.image_url ?? data.default_image_url)
    ? `${siteUrl}${data.image_url ?? data.default_image_url}`
    : `${siteUrl}/api/og?title=${encodeURIComponent(data.name)}&type=guide`
  return {
    title: `${data.name} — Boss Daddy Life`,
    description: data.description ?? undefined,
    alternates: { canonical: `${siteUrl}/gear/${slug}` },
    openGraph: {
      title: `${data.name} | Boss Daddy`,
      description: data.description ?? undefined,
      url: `${siteUrl}/gear/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function MerchDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Image gallery */}
        <MerchImageGallery
          images={galleryImages}
          alt={merch.name}
          comingSoon={!isAvailable}
        />

        {/* Details */}
        <div className="flex flex-col">
          <p className="text-xs text-accent-text uppercase tracking-[0.2em] font-bold mb-2">Boss Daddy Merch</p>
          <h1 className="text-3xl font-black text-prose mb-3">{merch.name}</h1>
          <p className="text-2xl font-bold text-accent-text-soft mb-1">{priceDisplay}</p>
          <p className="text-sm text-prose-faint mb-6">Free US shipping included</p>

          {merch.description && (
            <p className="text-prose-muted leading-relaxed mb-8">{merch.description}</p>
          )}

          {isAvailable && variants.length > 0 ? (
            <AddToCartForm variants={variants} />
          ) : (
            <div className="mt-auto pt-6 border-t border-soft">
              <p className="text-prose-faint text-sm">This item is coming soon — check back for the drop.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
