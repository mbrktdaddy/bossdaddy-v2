'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Props {
  images: string[]
  alt: string
  comingSoon?: boolean
}

export function MerchImageGallery({ images, alt, comingSoon = false }: Props) {
  const [selected, setSelected] = useState(0)
  const main = images[selected] ?? null

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div className="relative aspect-square bg-surface rounded-xl overflow-hidden">
        {main ? (
          <Image
            src={main}
            alt={alt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-7xl opacity-20">👕</div>
        )}
        {comingSoon && (
          <div className="absolute top-4 left-4 bg-accent-tint/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <p className="text-xs font-bold text-accent-text-soft uppercase tracking-widest">Coming soon</p>
          </div>
        )}
      </div>

      {/* Thumbnail strip — only renders when there are multiple images */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
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
