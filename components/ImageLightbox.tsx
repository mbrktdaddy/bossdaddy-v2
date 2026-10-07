'use client'

import { useState, type ReactNode, type MouseEvent } from 'react'
import GalleryViewer, { type GalleryItem } from '@/components/GalleryViewer'

interface Props {
  children: ReactNode
  className?: string
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
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [index, setIndex] = useState(0)

  function imgToItem(img: HTMLImageElement): GalleryItem {
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

  return (
    <>
      <div className={className} onClick={handleClick}>
        {children}
      </div>

      {items && (
        <GalleryViewer
          items={items}
          index={index}
          onIndexChange={setIndex}
          onClose={() => setItems(null)}
        />
      )}
    </>
  )
}
