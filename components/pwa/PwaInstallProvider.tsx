'use client'

// Single source of truth for PWA install state, mounted once at the root.
// - Registers the service worker site-wide so the WHOLE app is installable
//   (previously only registered when /tools/savings mounted its banner).
// - Captures the one-shot `beforeinstallprompt` event so any UI (the banner,
//   the account/menu button) can trigger install without racing each other
//   for the event.
// - Detects standalone (already installed) + iOS Safari (no programmatic
//   prompt — needs manual Share → Add to Home Screen).

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaInstallState {
  /** A native (Chrome/Android) install prompt is available right now. */
  canPrompt: boolean
  /** App is already running installed (standalone display mode). */
  isStandalone: boolean
  /** iOS Safari — no programmatic prompt; surface manual A2HS instructions. */
  isIOSSafari: boolean
  /** Fire the native prompt. Resolves true if the user accepted. */
  promptInstall: () => Promise<boolean>
}

const PwaInstallContext = createContext<PwaInstallState>({
  canPrompt: false,
  isStandalone: false,
  isIOSSafari: false,
  promptInstall: async () => false,
})

export function usePwaInstall() {
  return useContext(PwaInstallContext)
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // iOS Safari uses a non-standard navigator.standalone flag.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

function detectIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  // iPadOS reports as Mac — also detect via touch points.
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)
  if (!ios) return false
  // Only Safari proper supports Add-to-Home from the share sheet; in-app
  // browsers (FB/IG) and iOS Chrome/Firefox don't.
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV/.test(ua)
}

export default function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIOSSafari, setIsIOSSafari] = useState(false)

  useEffect(() => {
    // Client-only detection (post-hydration to avoid SSR mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsStandalone(detectStandalone())
    setIsIOSSafari(detectIOSSafari())

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failure isn't user-actionable — stay silent.
      })
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    function onInstalled() {
      setPromptEvent(null)
      setIsStandalone(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    setPromptEvent(null) // the event is single-use
    return choice.outcome === 'accepted'
  }, [promptEvent])

  return (
    <PwaInstallContext.Provider
      value={{ canPrompt: !!promptEvent && !isStandalone, isStandalone, isIOSSafari, promptInstall }}
    >
      {children}
    </PwaInstallContext.Provider>
  )
}
