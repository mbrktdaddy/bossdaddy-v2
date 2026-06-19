'use client'

// Always-available "Install Boss Daddy" entry point — the escape hatch for
// users who dismissed the opportunistic banner (its dismissal is global) but
// later want the app. Renders NOTHING when there's nothing to offer (already
// installed, or no native prompt and not iOS Safari), so it never shows a
// dead button. Install state comes from the root PwaInstallProvider.

import { useState } from 'react'
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider'
import { LABELS } from '@/lib/labels'

interface Props {
  /** 'card' = self-contained settings card; 'menu' = dropdown/drawer row. */
  variant?: 'card' | 'menu'
  /** Layout classes (padding/radius) for the 'menu' row, to match each host
   *  surface (header dropdown vs mobile drawer vs dashboard nav). */
  className?: string
}

export default function InstallAppButton({ variant = 'card', className = '' }: Props) {
  const { canPrompt, isIOSSafari, isStandalone, promptInstall } = usePwaInstall()
  const [showIosHint, setShowIosHint] = useState(false)

  // Nothing actionable: already installed, or no prompt available and not iOS.
  if (isStandalone || (!canPrompt && !isIOSSafari)) return null

  function handleClick() {
    if (canPrompt) { void promptInstall(); return }
    setShowIosHint((v) => !v) // iOS Safari — toggle the manual instructions
  }

  const iosHint = (
    <p className="text-sm text-prose-muted leading-snug">
      Tap the <span className="font-semibold text-prose">Share</span> button in Safari, then{' '}
      <span className="font-semibold text-prose">Add to Home Screen</span>.
    </p>
  )

  // Menu variant lives on dark surfaces (header dropdown, mobile drawer,
  // dashboard nav) styled with explicit zinc classes — NOT role tokens, which
  // would resolve to light values on the header's non-data-theme dark bg.
  if (variant === 'menu') {
    return (
      <div>
        <button
          type="button"
          onClick={handleClick}
          className={`w-full flex items-center gap-2 text-sm font-medium text-prose-muted hover:text-prose hover:bg-surface-hover transition-colors min-h-[44px] ${className || 'px-3 py-2.5 rounded-lg'}`}
        >
          <svg className="w-4 h-4 text-prose-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          {LABELS.app.short}
        </button>
        {showIosHint && (
          <p className="px-3 pb-2 text-xs text-zinc-400 leading-snug">
            Tap <span className="font-semibold text-zinc-200">Share</span> in Safari, then{' '}
            <span className="font-semibold text-zinc-200">Add to Home Screen</span>.
          </p>
        )}
      </div>
    )
  }

  // card variant — settings/account
  return (
    <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Boss Daddy App</p>
      <p className="text-sm text-prose-muted leading-snug mb-4">
        Install Boss Daddy on your phone — your tools, gear, and saved content, one tap from the home screen.
      </p>
      <button
        type="button"
        onClick={handleClick}
        className="bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
      >
        {canPrompt ? LABELS.app.short : 'How to install'}
      </button>
      {showIosHint && <div className="mt-3">{iosHint}</div>}
    </div>
  )
}
