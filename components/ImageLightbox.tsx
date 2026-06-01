'use client'

import { useEffect, useState, useRef, type ReactNode, type MouseEvent } from 'react'

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
 * Wraps rendered review/article content. Event delegation turns any
 * <figure><img> inside into a click-to-zoom lightbox. Placeholder stubs
 * (.bd-image-placeholder) and non-figure images are ignored.
 *
 * Gallery-aware: clicking an image inside a `.bd-image-grid` opens the WHOLE
 * gallery, so you can swipe / arrow / keyboard through it (with an "n / total"
 * counter) without closing. A standalone image opens on its own.
 */
export default function ImageLightbox({ children, className }: Props) {
  const [items, setItems] = useState<LightboxImage[] | null>(null)
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const close = () => setItems(null)
  // Plain closures over the current `items` — fine for onClick/touch handlers,
  // and they're not hook deps so there's nothing to stale.
  const go = (delta: number) => {
    const len = items?.length ?? 0
    if (len === 0) return
    setIndex((i) => (i + delta + len) % len)
  }

  // Re-binds whenever a gallery opens/changes, so it closes over the right
  // length without needing a ref.
  useEffect(() => {
    if (!items) return
    const len = items.length
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setItems(null)
      else if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % len)
      else if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + len) % len)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [items])

  function imgToItem(img: HTMLImageElement): LightboxImage {
    const figure = img.closest('figure')
    const caption = figure?.querySelector('figcaption')?.textContent ?? ''
    return { src: img.currentSrc || img.src, alt: img.alt, caption }
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.tagName !== 'IMG') return
    const figure = target.closest('figure')
    if (!figure || figure.classList.contains('bd-image-placeholder')) return
    const img = target as HTMLImageElement

    // Gallery-scoped: inside a .bd-image-grid → browse all its images; else solo.
    const grid = figure.closest('.bd-image-grid')
    const set = grid
      ? (Array.from(grid.querySelectorAll('figure img')) as HTMLImageElement[])
      : [img]
    const startIdx = Math.max(0, set.indexOf(img))
    setItems(set.map(imgToItem))
    setIndex(startIdx)
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    touchStartX.current = null
  }

  const current = items ? items[index] : null
  const multi = (items?.length ?? 0) > 1

  return (
    <>
      <div className={className} onClick={handleClick}>
        {children}
      </div>

      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/90 backdrop-blur-sm"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={current.alt || 'Image preview'}
        >
          <div
            className="relative max-w-6xl max-h-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.src}
              alt={current.alt}
              className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
              style={{ touchAction: 'pinch-zoom' }}
              draggable={false}
            />
            {current.caption && (
              <p className="text-sm text-prose-muted italic text-center max-w-2xl">
                {current.caption}
              </p>
            )}

            {multi && (
              <>
                {/* Prev / Next */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(-1) }}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(1) }}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {/* Counter */}
                <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900/60 text-white text-xs font-medium rounded-full tabular-nums">
                  {index + 1} / {items!.length}
                </span>
              </>
            )}

            <button
              type="button"
              onClick={close}
              aria-label="Close image"
              className="absolute top-2 right-2 w-9 h-9 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors"
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
