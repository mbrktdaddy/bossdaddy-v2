'use client'

// The signed-in account menu — avatar, dropdown, notification bell.
//
// EXTRACTED SO THERE IS ONE OF IT. This lived inside Header, which meant the
// (tools) route group — /goals, /today, /tools, i.e. the entire goals spine —
// had no account menu at all: its layout renders its own minimal chrome and had
// grown a bespoke "Account"/"Dashboard" text link instead. Two menus would have
// drifted the moment either gained an item, and this one gained three today
// (Your Stuff, Contacts, the pending badge).
//
// `useAuthUser` is exported because Header still needs the same values for its
// mobile drawer. Resolving auth twice on one page is fine — both calls read the
// browser client's local session, which is synchronous and networkless.

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LABELS } from '@/lib/labels'
import ConnectionBadge from '@/components/account/ConnectionBadge'
import ActivityMenu from '@/components/ActivityMenu'

interface AuthUser {
  userId: string | null
  username: string | null
  role: string | null
  avatarUrl: string | null
  /** false until the first client-side auth check completes. Used to render a
   *  neutral placeholder so a signed-in user never flashes the "Sign In" state. */
  resolved: boolean
}

/**
 * Client-side auth resolution for the public Header.
 *
 * Auth used to be resolved server-side in the (public) layout, but reading the
 * session cookie there forced the ENTIRE public surface to render dynamically
 * (audit H3). Resolving it here instead keeps every public page statically
 * prerenderable / ISR while the Header personalizes on the client.
 *
 * Flash-free by design: `onAuthStateChange` fires INITIAL_SESSION synchronously
 * from the browser client's local storage (no network), so the signed-in/out
 * decision is available within the first frame. We seed username/id optimistically
 * from that session, then refine username/role/avatar from the profiles row.
 * Until `resolved` flips true the trigger renders a neutral avatar skeleton —
 * so a signed-in user goes skeleton→avatar, never "Sign In"→avatar.
 */
export function useAuthUser(): AuthUser {
  const [auth, setAuth] = useState<Omit<AuthUser, 'resolved'>>({
    userId: null, username: null, role: null, avatarUrl: null,
  })
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      if (!user) {
        if (active) { setAuth({ userId: null, username: null, role: null, avatarUrl: null }); setResolved(true) }
        return
      }
      // Optimistic: show the signed-in state immediately from the local session.
      const fallbackName = user.email?.split('@')[0] ?? 'Account'
      if (active) {
        setAuth((prev) => ({ ...prev, userId: user.id, username: prev.username ?? fallbackName }))
        setResolved(true)
      }
      // Refine with the profile row (exact @username, role, avatar).
      supabase
        .from('profiles')
        .select('username, role, avatar_url')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!active) return
          setAuth({
            userId: user.id,
            username: data?.username ?? fallbackName,
            role: data?.role ?? 'member',
            avatarUrl: data?.avatar_url ?? null,
          })
        })
    })

    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  return { ...auth, resolved }
}

/**
 * @param withBell   Render the notifications bell alongside the avatar.
 * @param alwaysShow Header hides this below `md` because its hamburger drawer
 *                   repeats every link. The tools chrome has no drawer, so there
 *                   the menu must show at every width.
 */
export default function AccountMenu(
  { withBell = true, alwaysShow = false }: { withBell?: boolean; alwaysShow?: boolean } = {},
) {
  const { username, role, avatarUrl, userId, resolved } = useAuthUser()
  const pathname = usePathname()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const profileHref = '/account/settings'
  const hasDashboard = role === 'author' || role === 'admin'
  const vis = alwaysShow ? 'block' : 'hidden md:block'

  useEffect(() => {
    if (!userMenuOpen) return
    function onDoc(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setUserMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [userMenuOpen])

  return (
    <>
      {withBell && username && userId && <ActivityMenu userId={userId} />}
      {!resolved ? (
        // Neutral placeholder during the first-frame auth check — matches the
        // avatar-trigger footprint so a signed-in user goes skeleton→avatar,
        // never "Sign In"→avatar, and logged-out sees no jarring text pop.
        <div className={`${vis} w-8 h-8 rounded-full bg-surface-raised animate-pulse`} aria-hidden />
      ) : username ? (
        <div ref={userMenuRef} className={`${vis} relative`}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-colors ${
              userMenuOpen ? 'bg-surface-hover' : 'bg-surface-raised hover:bg-surface-hover'
            }`}
            aria-label="Account menu"
            aria-expanded={userMenuOpen}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={28} height={28} className="object-cover w-full h-full" unoptimized />
              ) : (
                username[0].toUpperCase()
              )}
            </div>
            {/* DESKTOP ONLY. The handle costs up to 120px, and with the bell beside
                it the trigger ran ~180px — which on the tools chrome (where
                `alwaysShow` keeps this visible at every width, since there's no
                drawer to hide it in) collided with the wordmark at 393px. It is also
                redundant: the panel this button opens leads with @{username}. So the
                trigger is avatar + chevron on a phone, which is what every app chrome
                does, and the name appears the moment there's room for it. */}
            <span className="hidden sm:inline text-sm text-prose-muted max-w-[120px] truncate">
              @{username}
            </span>
            <svg
              className={`w-3 h-3 text-prose-faint transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-surface-raised border border-strong rounded-xl p-1.5 z-50">
              <div className="px-3 py-2 border-b border-soft mb-1">
                <p className="text-[10px] uppercase tracking-widest text-prose-muted font-semibold">Signed in as</p>
                <p className="text-sm font-bold text-prose truncate">@{username}</p>
              </div>
              <Link
                href={profileHref}
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
              >
                <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Account Settings
              </Link>
              {/* Your Stuff sits ABOVE Settings — it's the page a member
                  actually wants, and it used to be reachable only by going to
                  a settings URL. */}
              <Link
                href="/account"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
              >
                <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4 4h8M8 14h5" />
                </svg>
                Your Stuff
              </Link>
              <Link
                href="/account/connections"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
              >
                <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m10-4.63a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {LABELS.contacts.short}
                <ConnectionBadge />
              </Link>
              <Link
                href="/account/messages"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
              >
                <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Messages
              </Link>
              {hasDashboard && (
                <Link
                  href="/dashboard"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
                >
                  <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />
                  </svg>
                  Dashboard
                </Link>
              )}
              <Link
                href="/install"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-surface-hover hover:text-prose transition-colors"
              >
                <svg className="w-4 h-4 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" />
                </svg>
                {LABELS.app.short}
              </Link>
              <div className="border-t border-soft mt-1 pt-1">
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-prose-muted hover:bg-danger-bg hover:text-danger-ink transition-colors text-left"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Link
          href={`/login?next=${encodeURIComponent(pathname)}`}
          className={`${vis} text-sm px-4 py-2 rounded-lg border border-strong text-prose-muted hover:border-copper hover:text-prose transition-colors`}
        >
          Sign In
        </Link>
      )}
    </>
  )
}
