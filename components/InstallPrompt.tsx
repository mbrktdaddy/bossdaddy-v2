'use client'

// ONE-TIME install prompt for mobile visitors. Replaces the permanent "Get the App"
// drawer row. Install state (native prompt event, standalone, iOS) comes from the
// root PwaInstallProvider — this component only owns WHEN to show and the one-shot flag.
//
// Show rules (all must hold):
//   - mobile only (md:hidden), never when already running installed (standalone)
//   - never after it was dismissed or acted on (localStorage flag, per device)
//   - not on immersive routes, /install itself, or review pages (they carry their own
//     fixed buy bar at the same edge), nor on any page showing the inline InstallPWA
//     banner (INLINE_INSTALL_ROUTES below)
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
import { Notice } from '@/components/ui/Notice'
import { isImmersiveRoute } from '@/lib/immersive-routes'

const DONE_KEY = 'bd:install-prompt-v1'
const VIEWS_KEY = 'bd:install-prompt-views'
const SETTLE_MS = 6000   // > WelcomeToast's 5s lifetime
const ENGAGED_MS = 30000

// Routes that render the inline InstallPWA banner: /tools (the hub),
// /tools/weekends-until, /tools/savings. Two install asks on one screen is the
// bug this list exists for — the floating prompt stays off all of them. A route
// list (not a mounted-banner registry) on purpose: it blocks on the very first
// render of a client navigation, where a registry would only learn about the
// banner after it mounted behind a loading.tsx and let the toast flash first.
// The cost is a manual step, so InstallPWA.tsx carries a pointer back here.
const INLINE_INSTALL_ROUTES = ['/tools']

// Someone who dismissed the inline banner has already said no — don't ask again
// from a second surface (readDone re-checks this on every navigation).
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

  // One-shot flag, read post-mount (avoids SSR mismatch) and again on every
  // navigation: this component lives in the layout, so a dismissal of the inline
  // InstallPWA banner on /tools would otherwise go unseen until the next reload
  // and the toast would then ask on the very next page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDone(readDone())
  }, [pathname])

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
    INLINE_INSTALL_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (done || isStandalone || blockedRoute || !settled || (views < 2 && !engaged)) return null

  const supporting = 'Your tools, gear and guides — one tap from the home screen.'

  // The shared Notice toast (continuity plan P17) — this component owns WHEN to
  // show; the box is the primitive's. `md:hidden` + the bottom offset are the
  // only things it adds: the offset rides above the tab strip, and at the screen
  // edge while the strip is scrolled away (Notice leaves `bottom` to the caller
  // because only the caller knows whether the strip is showing).
  return (
    <Notice
      variant="toast"
      role="region"
      label="Install Boss Daddy"
      title="Put Boss Daddy on your home screen"
      onDismiss={finish}
      dismissLabel="Not now"
      className="md:hidden transition-[bottom] duration-300"
      style={{ bottom: navHidden ? 'calc(env(safe-area-inset-bottom) + 0.75rem)' : `calc(${MOBILE_BOTTOM_NAV_OFFSET} + 1.25rem)` }}
      action={canPrompt ? (
        <button
          type="button"
          onClick={() => { finish(); void promptInstall() }}
          className={buttonVariants()}
        >
          Install
        </button>
      ) : (
        <Link href="/install" onClick={finish} className={buttonVariants()}>
          Install
        </Link>
      )}
    >
      {supporting}
    </Notice>
  )
}
