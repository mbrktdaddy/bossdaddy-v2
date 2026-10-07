'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { LightboxImage } from '@/components/LightboxImage'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/icons'

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
  const touchStartX = useRef<number | null>(null)
  if (pics.length === 0) return null

  const multi = pics.length > 1
  const sel = Math.min(selected, pics.length - 1)
  const main = pics[sel]
  const go = (delta: number) => setSelected((sel + delta + pics.length) % pics.length)

  const ARROW =
    'absolute top-1/2 -translate-y-1/2 w-11 h-11 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors'

  return (
    <div className="mb-8">
      <div
        className="relative"
        onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null || !multi) return
          const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
          touchStartX.current = null
        }}
      >
        <LightboxImage src={main} alt={alt} images={pics} index={sel}>
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
        {multi && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" className={`left-2 ${ARROW}`}>
              <ChevronLeftIcon className="w-5 h-5" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" className={`right-2 ${ARROW}`}>
              <ChevronRightIcon className="w-5 h-5" strokeWidth={2} />
            </button>
          </>
        )}
      </div>

      {pics.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {pics.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === sel}
              className={`relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 bg-white transition-all ${
                i === sel
                  ? 'border-accent'
                  : 'border-soft hover:border-strong'
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
