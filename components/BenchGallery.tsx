'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LightboxImage } from '@/components/LightboxImage'

interface Props {
  /** Cover first, then gallery images. Empty/falsy entries are ignored. */
  images: string[]
  alt: string
}

// Bench detail gallery: a main image (zoomable via the shared lightbox) plus a
// thumbnail strip when there's more than one photo. Cover stays index 0. White
// background + object-contain so product shots aren't awkwardly cropped —
// matches the previous single-image bench treatment.
export function BenchGallery({ images, alt }: Props) {
  const pics = images.filter(Boolean)
  const [selected, setSelected] = useState(0)
  if (pics.length === 0) return null

  const main = pics[Math.min(selected, pics.length - 1)]

  return (
    <div className="mb-8">
      <LightboxImage src={main} alt={alt}>
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-white border border-soft">
          <Image
            src={main}
            alt={alt}
            fill
            className="object-contain p-3"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        </div>
      </LightboxImage>

      {pics.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {pics.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === selected}
              className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 bg-white transition-all ${
                i === selected
                  ? 'border-accent opacity-100'
                  : 'border-soft opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={src}
                alt={`${alt} — view ${i + 1}`}
                fill
                className="object-contain p-1"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
