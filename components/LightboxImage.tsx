'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import GalleryViewer from '@/components/GalleryViewer'

interface Props {
  src: string
  alt: string
  children: React.ReactNode
  /** Open the viewer across all of these (when more than one). Default: just `src`. */
  images?: string[]
  /** Starting position within `images`. Default: where `src` sits in it, else 0. */
  index?: number
}

export function LightboxImage({ src, alt, children, images, index }: Props) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(0)

  const list = images && images.length > 1 ? images : [src]
  const items = list.map((s) => ({ src: s, alt }))

  function openViewer() {
    const start = index ?? Math.max(0, list.indexOf(src))
    setCurrent(Math.min(Math.max(start, 0), list.length - 1))
    setOpen(true)
  }

  return (
    <>
      <div onClick={openViewer} className="cursor-zoom-in">
        {children}
      </div>

      {/*
        optimized: next/image routes through /_next/image so the browser only
        sees a same-origin request — bypasses CSP img-src restrictions and
        handles upstream redirect chains (Amazon's media hosts).
      */}
      {open && createPortal(
        <GalleryViewer
          items={items}
          index={current}
          onIndexChange={setCurrent}
          onClose={() => setOpen(false)}
          optimized
        />,
        document.body
      )}
    </>
  )
}
