'use client'

import { useState } from 'react'
import { MerchImageGallery } from '@/components/MerchImageGallery'
import AddToCartForm from './AddToCartForm'

interface Variant {
  id: string
  size: string | null
  color: string | null
  retail_price_cents: number
  in_stock: boolean
  image_url?: string | null
}

interface Props {
  galleryImages: string[]
  variants: Variant[]
  name: string
  priceDisplay: string
  description: string | null
  isAvailable: boolean
}

// Client wrapper that lets the variant picker drive the gallery: selecting a
// color jumps the main image to that color's mockup. Both pieces were
// previously independent server-rendered siblings with no shared state.
export default function MerchProductView({
  galleryImages,
  variants,
  name,
  priceDisplay,
  description,
  isAvailable,
}: Props) {
  const [imageIndex, setImageIndex] = useState(0)

  function handleVariantChange(v: Variant | undefined) {
    if (!v?.image_url) return
    // Each color's mockup lives in galleryImages (synced from Printful
    // type==='preview'); jump to it. No-op if this variant's image isn't
    // in the gallery set (e.g. only a thumbnail fallback exists).
    const idx = galleryImages.indexOf(v.image_url)
    if (idx >= 0) setImageIndex(idx)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
      <MerchImageGallery
        images={galleryImages}
        alt={name}
        comingSoon={!isAvailable}
        selectedIndex={imageIndex}
        onSelect={setImageIndex}
      />

      <div className="flex flex-col">
        <p className="text-xs text-accent-text uppercase tracking-[0.2em] font-bold mb-2">Boss Daddy Merch</p>
        <h1 className="text-3xl font-black text-prose mb-3">{name}</h1>
        <p className="text-2xl font-bold text-accent-text-soft mb-1">{priceDisplay}</p>
        <p className="text-sm text-prose-faint mb-6">Free US shipping included</p>

        {description && (
          <p className="text-prose-muted leading-relaxed mb-8">{description}</p>
        )}

        {isAvailable && variants.length > 0 ? (
          <AddToCartForm variants={variants} onVariantChange={handleVariantChange} />
        ) : (
          <div className="mt-auto pt-6 border-t border-soft">
            <p className="text-prose-faint text-sm">This item is coming soon — check back for the drop.</p>
          </div>
        )}
      </div>
    </div>
  )
}
