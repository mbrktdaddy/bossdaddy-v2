'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { BagIcon, XIcon } from '@/components/icons'
import { IconButton } from '@/components/ui/IconButton'
import { Badge } from '@/components/ui/Badge'

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

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

export function MerchImageGallery({ images, alt, comingSoon = false, selectedIndex, onSelect }: Props) {
  const [internal, setInternal] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const selected = selectedIndex ?? internal
  const select = (i: number) => (onSelect ? onSelect(i) : setInternal(i))
  const main = images[selected] ?? null
  const many = images.length > 1
  const go = (delta: number) => select((selected + delta + images.length) % images.length)

  // Keyboard nav while zoomed: arrows to move, Escape to close.
  useEffect(() => {
    if (!zoomed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(false)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomed, selected, images.length])

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — click to zoom, arrows to page */}
      <div className="relative aspect-square bg-surface rounded-xl overflow-hidden">
        {main ? (
          <>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="group absolute inset-0 z-0 w-full h-full cursor-zoom-in"
              aria-label="Zoom image"
            >
              <Image src={main} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" priority />
              <span className="absolute bottom-3 right-3 bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.2-5.2m2.2-5.3a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0zM10.5 7.5v6m3-3h-6" />
                </svg>
              </span>
            </button>
            {many && (
              <>
                <IconButton
                  tone="overlay"
                  label="Previous image"
                  onClick={(e) => { e.stopPropagation(); go(-1) }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
                >
                  <Chevron dir="left" />
                </IconButton>
                <IconButton
                  tone="overlay"
                  label="Next image"
                  onClick={(e) => { e.stopPropagation(); go(1) }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
                >
                  <Chevron dir="right" />
                </IconButton>
                <span className="absolute bottom-3 left-3 z-10 bg-black/50 text-white text-xs rounded-full px-2.5 py-1">
                  {selected + 1} / {images.length}
                </span>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><BagIcon className="w-16 h-16 text-prose-faint" strokeWidth={1} aria-hidden /></div>
        )}
        {comingSoon && (
          <Badge tone="neutral" className="absolute top-4 left-4 z-10">Coming soon</Badge>
        )}
      </div>

      {/* Thumbnail strip — only renders when there are multiple images */}
      {many && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => select(i)}
              className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                i === selected ? 'border-accent opacity-100' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <Image src={src} alt={`${alt} view ${i + 1}`} fill className="object-cover" sizes="64px" />
            </button>
          ))}
        </div>
      )}

      {/* Zoom lightbox — arrows to page, click backdrop / ✕ / Esc to close */}
      {zoomed && main && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomed(false)}
          role="dialog"
          aria-modal="true"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main} alt={alt} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />

          {many && (
            <>
              <IconButton
                  tone="overlay"
                  label="Previous image"
                  onClick={(e) => { e.stopPropagation(); go(-1) }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10"
                >
                  <Chevron dir="left" />
                </IconButton>
              <IconButton
                  tone="overlay"
                  label="Next image"
                  onClick={(e) => { e.stopPropagation(); go(1) }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10"
                >
                  <Chevron dir="right" />
                </IconButton>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-sm rounded-full px-3 py-1">
                {selected + 1} / {images.length}
              </span>
            </>
          )}

          <IconButton
            tone="overlay"
            label="Close"
            onClick={(e) => { e.stopPropagation(); setZoomed(false) }}
            className="absolute top-4 right-4 z-10"
          >
            <XIcon className="w-5 h-5" strokeWidth={2} />
          </IconButton>
        </div>
      )}
    </div>
  )
}
