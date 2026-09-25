'use client'

import { useEffect, useRef } from 'react'
import { XIcon } from '@/components/icons'

// The one modal. Built on the native <dialog> + showModal(), so the browser
// supplies what every hand-rolled overlay re-implemented (and mostly missed):
// top-layer stacking, focus moved in AND trapped, Escape, and an inert page
// behind. We add only body-scroll lock and backdrop-click dismissal.
//
// Mount it when open (`{open && <Modal …/>}`); unmounting closes it.
// Anything that must sit ABOVE the modal (e.g. a crop overlay) has to render
// INSIDE it — the top layer beats any z-index.

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-6xl',
} as const

interface ModalProps {
  onClose: () => void
  /** Accessible name — pass `label` or the id of a visible heading via `labelledBy`. */
  label?: string
  labelledBy?: string
  size?: keyof typeof SIZE
  /** false while a request is in flight: Escape + backdrop click are ignored. */
  dismissible?: boolean
  /** false when a stray click would throw work away (Escape still closes). */
  closeOnBackdrop?: boolean
  /** Layout/padding for the panel contents. */
  className?: string
  children: React.ReactNode
}

export function Modal({ onClose, label, labelledBy, size = 'md', dismissible = true, closeOnBackdrop = true, className = '', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (dialog.open) dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      aria-labelledby={labelledBy}
      // Escape fires `cancel`; keep React in charge of whether we actually close.
      onCancel={(e) => { e.preventDefault(); if (dismissible) onClose() }}
      // A click whose target is the <dialog> itself landed on the ::backdrop.
      onClick={(e) => { if (e.target === e.currentTarget && dismissible && closeOnBackdrop) onClose() }}
      className={`m-auto w-[calc(100%-2rem)] ${SIZE[size]} max-h-[calc(100dvh-2rem)] p-0 text-prose bg-surface-sunken border border-soft rounded-xl shadow-2xl backdrop:bg-zinc-900/75 backdrop:backdrop-blur-sm`}
    >
      {/* The inner box covers the whole dialog, so only the ::backdrop is "outside". */}
      <div className={className}>{children}</div>
    </dialog>
  )
}

/** The X. 44px tap target; pass the same handler as the modal's onClose. */
export function CloseButton({ onClick, label = 'Close', className = '' }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center justify-center w-11 h-11 -m-2.5 rounded-lg text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors ${className}`}
    >
      <XIcon className="w-5 h-5" strokeWidth={2} />
    </button>
  )
}
