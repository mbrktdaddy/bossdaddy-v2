'use client'

import { useEffect, useState, type ReactNode, type MouseEvent } from 'react'

interface Props {
  children: ReactNode
  className?: string
}

interface LightboxImage {
  src: string
  alt: string
  caption: string
}

/**
 * Wraps rendered review/article content. Uses event delegation to turn any
 * <figure><img> inside into a click-to-zoom lightbox. Placeholder stubs
 * (.bd-image-placeholder) and non-figure images are ignored.
 */
export default function ImageLightbox({ children, className }: Props) {
  const [current, setCurrent] = useState<LightboxImage | null>(null)

  useEffect(() => {
    if (!current) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setCurrent(null) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [current])

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG') return
    const figure = target.closest('figure')
    if (!figure || figure.classList.contains('bd-image-placeholder')) return
    const img = target as HTMLImageElement
    const caption = figure.querySelector('figcaption')?.textContent ?? ''
    setCurrent({ src: img.currentSrc || img.src, alt: img.alt, caption })
  }

  return (
    <>
      <div className={className} onClick={handleClick}>
        {children}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setCurrent(null)}
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || 'Image preview'}
        >
          <div
            className="relative max-w-6xl max-h-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            {current.caption && (
              <p className="text-sm text-gray-300 italic text-center max-w-2xl">
                {current.caption}
              </p>
            )}
            <button
              type="button"
              onClick={() => setCurrent(null)}
              aria-label="Close image"
              className="absolute top-2 right-2 w-9 h-9 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  )
}
