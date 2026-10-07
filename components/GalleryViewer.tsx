'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/components/icons'

export interface GalleryItem {
  src: string
  alt: string
  caption?: string
}

interface Props {
  items: GalleryItem[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  /**
   * Render through next/image (same-origin /_next/image) instead of a raw <img>.
   * Needed for remote product photos: it sidesteps CSP img-src limits and
   * upstream redirect chains (Amazon's media hosts).
   */
  optimized?: boolean
}

const BUTTON =
  'w-11 h-11 bg-zinc-900/60 hover:bg-zinc-900/80 text-white rounded-full flex items-center justify-center transition-colors'

/**
 * The shared fullscreen image overlay: backdrop, image, prev/next, "i / n"
 * counter, close, ←/→/Esc keys, touch swipe and body scroll-lock. Controlled:
 * the parent owns `index`. Prev/next/counter only render for more than one item;
 * navigation wraps.
 */
export default function GalleryViewer({ items, index, onIndexChange, onClose, optimized = false }: Props) {
  const touchStartX = useRef<number | null>(null)
  const len = items.length
  const multi = len > 1
  const safeIndex = len > 0 ? Math.min(Math.max(index, 0), len - 1) : 0
  const current = items[safeIndex]

  const go = (delta: number) => {
    if (len < 2) return
    onIndexChange((safeIndex + delta + len) % len)
  }

  // Re-binds when the index/length change so the handler never reads a stale one.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (len > 1 && e.key === 'ArrowRight') onIndexChange((safeIndex + 1) % len)
      else if (len > 1 && e.key === 'ArrowLeft') onIndexChange((safeIndex - 1 + len) % len)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [len, safeIndex, onIndexChange, onClose])

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null) return
    const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
    touchStartX.current = null
  }

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/90 backdrop-blur-sm"
      onClick={onClose}
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
        {optimized ? (
          <div className="relative w-[92vw] max-w-6xl h-[85vh]">
            <Image
              src={current.src}
              alt={current.alt}
              fill
              priority
              sizes="92vw"
              className="object-contain rounded-lg select-none"
              draggable={false}
            />
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.src}
            alt={current.alt}
            className="max-w-full max-h-[85vh] object-contain rounded-lg select-none"
            style={{ touchAction: 'pinch-zoom' }}
            draggable={false}
          />
        )}
        {current.caption && (
          <p className="text-sm text-prose-muted italic text-center max-w-2xl">
            {current.caption}
          </p>
        )}

        {multi && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(-1) }}
              aria-label="Previous image"
              className={`absolute left-2 top-1/2 -translate-y-1/2 ${BUTTON}`}
            >
              <ChevronLeftIcon className="w-5 h-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(1) }}
              aria-label="Next image"
              className={`absolute right-2 top-1/2 -translate-y-1/2 ${BUTTON}`}
            >
              <ChevronRightIcon className="w-5 h-5" strokeWidth={2} />
            </button>
            <span className="absolute top-2 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-zinc-900/60 text-white text-xs font-medium rounded-full tabular-nums">
              {safeIndex + 1} / {len}
            </span>
          </>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close image"
          className={`absolute top-2 right-2 ${BUTTON}`}
        >
          <XIcon className="w-5 h-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
