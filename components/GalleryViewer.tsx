'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '@/components/icons'
import { Modal } from '@/components/ui/Modal'
import { IconButton } from '@/components/ui/IconButton'

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

/**
 * The shared fullscreen image viewer: image, prev/next, "i / n" counter, close,
 * ←/→ keys and touch swipe. It is a `<Modal size="full">`, so Escape, the focus
 * trap, the body scroll lock and the inert page behind come from the native
 * dialog — this file owns only the gallery. Controlled: the parent owns `index`.
 * Prev/next/counter only render for more than one item; navigation wraps.
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

  // Arrow keys only (Escape is the dialog's). Re-binds when the index/length
  // change so the handler never reads a stale one.
  useEffect(() => {
    if (len < 2) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') onIndexChange((safeIndex + 1) % len)
      else if (e.key === 'ArrowLeft') onIndexChange((safeIndex - 1 + len) % len)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [len, safeIndex, onIndexChange])

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
    <Modal size="full" onClose={onClose} label={current.alt || 'Image preview'}>
      {/* The dialog IS the viewport, so a tap on the scrim lands on this box, not
          on the ::backdrop the Modal listens for — dismissal is wired here. Only
          a direct hit closes: the image, caption and controls are children. Swipe
          works from anywhere on the screen, not just over the photo. */}
      <div
        className="relative flex h-dvh w-screen flex-col items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Close first in DOM order: the dialog focuses its first focusable. */}
        {/* z-10 on the controls: the optimized photo box is 92vw × 85vh, a positioned
            sibling later in the DOM, so on a phone it would paint over (and swallow
            taps meant for) anything not lifted above it. */}
        <div className="absolute right-3 top-3 z-10">
          <IconButton tone="overlay" label="Close image" onClick={onClose}>
            <XIcon className="w-5 h-5" strokeWidth={2} />
          </IconButton>
        </div>

        {multi && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-3 flex h-11 items-center justify-center">
              <span className="rounded-sm bg-chrome px-2.5 py-1.5 font-display text-[11px] font-black uppercase leading-none tracking-[0.14em] text-white tabular-nums">
                {safeIndex + 1} / {len}
              </span>
            </div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
              <IconButton tone="overlay" label="Previous image" onClick={() => go(-1)}>
                <ChevronLeftIcon className="w-5 h-5" strokeWidth={2} />
              </IconButton>
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
              <IconButton tone="overlay" label="Next image" onClick={() => go(1)}>
                <ChevronRightIcon className="w-5 h-5" strokeWidth={2} />
              </IconButton>
            </div>
          </>
        )}

        <div className="flex max-h-full max-w-6xl flex-col items-center gap-3">
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
          {/* White, not a role token: this sits on the chrome scrim, outside any
              dark zone, so prose-muted would resolve to the light page's grey. */}
          {current.caption && (
            <p className="text-sm text-white/80 italic text-center max-w-2xl">
              {current.caption}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}
