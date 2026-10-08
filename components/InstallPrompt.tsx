'use client'

// ONE-TIME install prompt for mobile visitors. Replaces the permanent "Get the App"
// drawer row. Install state (native prompt event, standalone, iOS) comes from the
// root PwaInstallProvider — this component only owns WHEN to show and the one-shot flag.
//
// Show rules (all must hold):
//   - mobile only (md:hidden), never when already running installed (standalone)
//   - never after it was dismissed or acted on (localStorage flag, per device)
//   - not on immersive routes, /install itself, or review pages (they carry their own
//     fixed buy bar at the same edge)
//   - not on the first page view: needs a 2nd page view this session OR ~30s on the page
//   - never inside the first SETTLE_MS of a page load, which keeps it clear of
//     WelcomeToast (it self-dismisses after 5s and has no shared state to observe)

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePwaInstall } from '@/components/pwa/PwaInstallProvider'
import { MOBILE_BOTTOM_NAV_OFFSET } from '@/components/MobileBottomNav'
import { useBottomNavHidden } from '@/components/useBottomNavHidden'
import { buttonVariants } from '@/components/ui/Button'
import { XIcon } from '@/components/icons'
import { isImmersiveRoute } from '@/lib/immersive-routes'

const DONE_KEY = 'bd:install-prompt-v1'
const VIEWS_KEY = 'bd:install-prompt-views'
const SETTLE_MS = 6000   // > WelcomeToast's 5s lifetime
const ENGAGED_MS = 30000

// The Tools pages carry their own inline install banner (InstallPWA). Someone who
// dismissed THAT has already said no — don't ask again from a second surface.
const INLINE_BANNER_DISMISS_KEY = 'bd:pwa-install-dismissed-v1'

function readDone(): boolean {
  try { return !!localStorage.getItem(DONE_KEY) || !!localStorage.getItem(INLINE_BANNER_DISMISS_KEY) } catch { return true }
}

export default function InstallPrompt() {
  const pathname = usePathname()
  const navHidden = useBottomNavHidden()
  const { canPrompt, isStandalone, promptInstall } = usePwaInstall()
  const [done, setDone] = useState(true) // closed until localStorage is read
  const [views, setViews] = useState(0)
  const [settled, setSettled] = useState(false)
  const [engaged, setEngaged] = useState(false)

  // One-shot flag, read post-mount (avoids SSR mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(readDone())
  }, [])

  // Count page views for this session (client navigations included).
  useEffect(() => {
    let n = 1
    try {
      n = Number(sessionStorage.getItem(VIEWS_KEY) ?? '0') + 1
      sessionStorage.setItem(VIEWS_KEY, String(n))
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews(n)
  }, [pathname])

  // Timers run once per mount (the layout persists across client navigations).
  useEffect(() => {
    const a = window.setTimeout(() => setSettled(true), SETTLE_MS)
    const b = window.setTimeout(() => setEngaged(true), ENGAGED_MS)
    return () => { window.clearTimeout(a); window.clearTimeout(b) }
  }, [])

  function finish() {
    setDone(true)
    try { localStorage.setItem(DONE_KEY, String(Date.now())) } catch {}
  }

  const blockedRoute =
    isImmersiveRoute(pathname) ||
    pathname === '/install' ||
    pathname.startsWith('/install/') ||
    pathname.startsWith('/reviews/') ||
    // /tools/* shows the inline InstallPWA banner — never two install asks at once.
    pathname === '/tools' ||
    pathname.startsWith('/tools/')

  if (done || isStandalone || blockedRoute || !settled || (views < 2 && !engaged)) return null

  const supporting = 'Your tools, gear and guides — one tap from the home screen.'

  return (
    <div
      role="region"
      aria-label="Install Boss Daddy"
      className="md:hidden fixed left-3 right-3 z-40 bg-surface-raised border border-strong rounded-xl p-3 flex items-center gap-3 transition-[bottom] duration-300"
      // Follows the tab strip: above it normally, at the screen edge while it's scrolled away.
      style={{ bottom: navHidden ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : `calc(${MOBILE_BOTTOM_NAV_OFFSET} + 1.25rem)` }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-prose leading-snug">Put Boss Daddy on your home screen</p>
        <p className="text-xs text-prose-muted leading-snug mt-0.5">{supporting}</p>
      </div>
      {canPrompt ? (
        <button
          type="button"
          onClick={() => { finish(); void promptInstall() }}
          className={buttonVariants({ size: 'md', className: 'shrink-0' })}
        >
          Install
        </button>
      ) : (
        <Link
          href="/install"
          onClick={finish}
          className={buttonVariants({ size: 'md', className: 'shrink-0' })}
        >
          Install
        </Link>
      )}
      <button
        type="button"
        onClick={finish}
        aria-label="Not now"
        className="shrink-0 -mr-1 w-11 h-11 flex items-center justify-center text-prose-faint hover:text-prose transition-colors"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
