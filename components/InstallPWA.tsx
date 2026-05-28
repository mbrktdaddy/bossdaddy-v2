'use client'

// PWA install affordance — handles both browser paths and the iOS Safari
// path (which doesn't fire beforeinstallprompt and requires a manual
// Share → Add to Home Screen instruction).
//
// Mounted on /tools/savings. Persists dismissal in localStorage so it
// doesn't re-show on every visit. Also auto-suppresses when the app is
// already running standalone (the user already installed).

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'bd:pwa-install-dismissed-v1'

type DismissReason = 'installed' | 'dismissed' | null

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari uses a non-standard property
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPad on modern iPadOS reports as Mac — also detect via touch points
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
}

function isIOSSafari(): boolean {
  if (!isIOS()) return false
  const ua = navigator.userAgent
  // In-app browsers (FB, Twitter, etc.) lack the Safari token; Chrome on
  // iOS does have CriOS. Only Safari proper supports Add-to-Home from the
  // share sheet reliably.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV/.test(ua)
}

// Lazy initial dismiss state — runs once at first render. Done here rather
// than in useEffect because (a) the env checks are synchronous browser
// queries we want to settle before first paint to avoid flicker, and
// (b) React 19 lints unconditional setState inside an effect.
function initialDismissReason(): DismissReason {
  if (typeof window === 'undefined') return null
  if (isStandalone()) return 'installed'
  try {
    if (localStorage.getItem(DISMISS_KEY)) return 'dismissed'
  } catch {
    // localStorage can throw in private modes — just treat as not-dismissed
  }
  return null
}

export default function InstallPWA() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosPromptVisible, setIosPromptVisible] = useState(false)
  const [dismissed, setDismissed] = useState<DismissReason>(initialDismissReason)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dismissed) return

    // Register the service worker so Chrome considers us installable.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Silent — SW registration failure isn't user-actionable
      })
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS doesn't fire beforeinstallprompt — show the manual instruction
    // banner for Safari-on-iOS users. Slight delay so we don't pop up on
    // the first paint.
    if (isIOSSafari()) {
      const timer = window.setTimeout(() => setIosPromptVisible(true), 1500)
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
        window.clearTimeout(timer)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [dismissed])

  function onDismiss() {
    setDismissed('dismissed')
    setInstallEvent(null)
    setIosPromptVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  }

  async function onInstall() {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      setDismissed('installed')
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    }
    setInstallEvent(null)
  }

  if (dismissed) return null

  // Chrome / Edge / Android Chrome path — native prompt available
  if (installEvent) {
    return (
      <div className="bg-accent-tint border border-accent-border/60 rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
            Install Boss Daddy
          </p>
          <p className="text-sm text-prose-muted leading-snug">
            Add the Savings tool to your home screen. One-tap return from your bank app.
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onInstall}
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

  // iOS Safari path — manual Share → Add to Home Screen instructions
  if (iosPromptVisible) {
    return (
      <div className="bg-accent-tint border border-accent-border/60 rounded-xl p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
            Install Boss Daddy
          </p>
          <p className="text-sm text-prose-muted leading-snug">
            Tap the <span className="font-semibold text-prose">Share</span> button at the bottom of
            Safari, then <span className="font-semibold text-prose">Add to Home Screen</span>. Makes
            returning from your bank a one-tap deal.
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
