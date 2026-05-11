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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('merch').select('name, description').eq('slug', slug).maybeSingle()
  if (!data) return {}
  return {
    title: `${data.name} — Boss Daddy Life`,
    description: data.description ?? undefined,
    alternates: { canonical: `/gear/${slug}` },
  }
}

export default async function MerchDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: merch } = await supabase
    .from('merch')
    .select('id, slug, name, description, image_url, default_image_url, images, status, currency')
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
  // Prefer synced images array; fall back to single thumbnail if empty
  const galleryImages: string[] = (merch as { images?: string[] }).images?.length
    ? (merch as { images: string[] }).images
    : fallbackImage ? [fallbackImage] : []

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
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-400 transition-colors mb-8"
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
          <p className="text-xs text-orange-500 uppercase tracking-[0.2em] font-bold mb-2">Boss Daddy Merch</p>
          <h1 className="text-3xl font-black text-white mb-3">{merch.name}</h1>
          <p className="text-2xl font-bold text-orange-400 mb-1">{priceDisplay}</p>
          <p className="text-sm text-gray-500 mb-6">Free US shipping included</p>

          {merch.description && (
            <p className="text-gray-400 leading-relaxed mb-8">{merch.description}</p>
          )}

          {isAvailable && variants.length > 0 ? (
            <AddToCartForm variants={variants} />
          ) : (
            <div className="mt-auto pt-6 border-t border-gray-800">
              <p className="text-gray-500 text-sm">This item is coming soon — check back for the drop.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
