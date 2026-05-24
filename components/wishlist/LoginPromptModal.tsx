'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'

interface Props {
  onClose: () => void
  returnPath: string
}

export function LoginPromptModal({ onClose, returnPath }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Lock body scroll
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Focus dialog on open
    dialogRef.current?.focus()

    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        tabIndex={-1}
        className="relative z-10 w-full max-w-sm bg-surface-sunken border border-soft rounded-xl p-6 shadow-2xl outline-none"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-prose-faint hover:text-prose-muted transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-accent-tint border border-accent-border/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <h3 id="login-modal-title" className="text-lg font-black mb-1">Join to vote</h3>
          <p className="text-sm text-prose-muted mb-6">
            Create a free account to vote on what Boss Daddy reviews next and get notified when it&apos;s live.
          </p>

          <div className="space-y-3">
            <Link
              href={`/register?next=${encodeURIComponent(returnPath)}`}
              className="block w-full py-3 bg-accent hover:bg-accent-hover text-white text-sm font-semibold rounded-xl transition-colors text-center"
            >
              Create free account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(returnPath)}`}
              className="block w-full py-3 bg-surface hover:bg-surface-raised border border-strong text-prose text-sm font-semibold rounded-xl transition-colors text-center"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
