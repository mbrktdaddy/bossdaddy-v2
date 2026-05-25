'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'

interface Props {
  src: string
  alt: string
  children: React.ReactNode
}

export function LightboxImage({ src, alt, children }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <div onClick={() => setOpen(true)} className="cursor-zoom-in">
        {children}
      </div>

      {open && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt || 'Image preview'}
          className="fixed inset-0 z-50 bg-zinc-900/90 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-10 text-white/70 hover:text-white transition-colors p-2"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/*
            Next/Image routes through /_next/image?url=... so the browser
            only sees a same-origin request — bypasses CSP img-src
            restrictions AND handles upstream redirect chains (Amazon's
            m.media-amazon.com → images-na.ssl-images-amazon.com pattern)
            that break a raw <img> tag. Container takes 92vw × 92vh so
            object-contain scales the image to fit while preserving its
            aspect ratio.
          */}
          <div
            className="relative w-[92vw] h-[92vh] cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={src}
              alt={alt}
              fill
              priority
              sizes="92vw"
              className="object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
