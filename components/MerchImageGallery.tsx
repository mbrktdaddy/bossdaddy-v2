'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  images: string[]
  alt: string
  comingSoon?: boolean
  // Optional controlled selection — when provided (with onSelect), the parent
  // drives which image is shown (e.g. swapping to the picked color's mockup).
  // Omitted → the gallery manages its own thumbnail state as before.
  selectedIndex?: number
  onSelect?: (i: number) => void
}

export function MerchImageGallery({ images, alt, comingSoon = false, selectedIndex, onSelect }: Props) {
  const [internal, setInternal] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const selected = selectedIndex ?? internal
  const select = (i: number) => (onSelect ? onSelect(i) : setInternal(i))
  const main = images[selected] ?? null

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — click to zoom */}
      <div className="relative aspect-square bg-surface rounded-xl overflow-hidden">
        {main ? (
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="group absolute inset-0 w-full h-full cursor-zoom-in"
            aria-label="Zoom image"
          >
            <Image
              src={main}
              alt={alt}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
            <span className="absolute bottom-3 right-3 bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m2.2-5.3a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0zM10.5 7.5v6m3-3h-6" />
              </svg>
            </span>
          </button>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl opacity-20">👕</div>
        )}
        {comingSoon && (
          <div className="absolute top-4 left-4 bg-accent-tint/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <p className="text-xs font-bold text-accent-text-soft uppercase tracking-widest">Coming soon</p>
          </div>
        )}
      </div>

      {/* Zoom lightbox */}
      {zoomed && main && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main} alt={alt} className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Thumbnail strip — only renders when there are multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => select(i)}
              className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === selected
                  ? 'border-accent opacity-100'
                  : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <Image
                src={src}
                alt={`${alt} view ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
