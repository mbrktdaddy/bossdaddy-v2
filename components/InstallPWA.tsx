'use client'

// PWA install BANNER — the opportunistic, dismissable affordance for engaged
// pages (savings, tools hub, weekends, dashboard). Install state comes from
// the root-level PwaInstallProvider; this component only owns presentation +
// per-device dismissal. Copy is parameterized so each surface can speak to its
// own context. For the always-available entry point see InstallAppButton.

import { useEffect, useState } from 'react'
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider'

const DISMISS_KEY = 'bd:pwa-install-dismissed-v1'

interface Props {
  /** Banner headline. Defaults to the brand-generic pitch. */
  headline?: string
  /** Supporting line — short + benefit-focused. */
  body?: string
}

function alreadyDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try { return !!localStorage.getItem(DISMISS_KEY) } catch { return false }
}

export default function InstallPWA({
  headline = 'Install Boss Daddy',
  body = 'Add Boss Daddy to your home screen — your tools and gear, one tap away.',
}: Props) {
  const { canPrompt, isIOSSafari, isStandalone, promptInstall } = usePwaInstall()
  const [dismissed, setDismissed] = useState(false)
  const [iosVisible, setIosVisible] = useState(false)

  // Settle dismissal from localStorage post-mount (avoids SSR mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (alreadyDismissed()) setDismissed(true)
  }, [])

  // iOS Safari has no programmatic prompt — reveal the manual A2HS hint after
  // a beat so it doesn't pop on first paint.
  useEffect(() => {
    if (!isIOSSafari || isStandalone || dismissed) return
    const t = window.setTimeout(() => setIosVisible(true), 1500)
    return () => window.clearTimeout(t)
  }, [isIOSSafari, isStandalone, dismissed])

  function onDismiss() {
    setDismissed(true)
    setIosVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  if (dismissed || isStandalone) return null

  // Chrome / Edge / Android — native prompt available.
  if (canPrompt) {
    return (
      <div className="bg-accent-tint border border-accent-border/60 rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{headline}</p>
          <p className="text-sm text-prose-muted leading-snug">{body}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={() => { void promptInstall() }}
            className="bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors min-h-[44px]"
          >
            Install
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-prose-faint hover:text-prose-muted transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    )
  }

  // iOS Safari — manual Share → Add to Home Screen instructions.
  if (iosVisible) {
    return (
      <div className="bg-accent-tint border border-accent-border/60 rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">{headline}</p>
          <p className="text-sm text-prose-muted leading-snug">
            Tap the <span className="font-semibold text-prose">Share</span> button at the bottom of
            Safari, then <span className="font-semibold text-prose">Add to Home Screen</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-prose-faint hover:text-prose-muted transition-colors shrink-0 px-2 py-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    )
  }

  return null
}
