'use client'

// The signed-in account menu — avatar, dropdown, notification bell.
//
// EXTRACTED SO THERE IS ONE OF IT. This lived inside Header, which meant the goals
// spine — /goals, /today, /tools — had no account menu at all: it ran a separate
// `(tools)` chrome that had grown a bespoke "Account"/"Dashboard" text link instead.
// Two menus would have drifted the moment either gained an item, and this one gained
// three in the session that extracted it (Account, Contacts, the pending badge).
//
// That second chrome is gone as of nav-ia-plan Phase C — every authenticated surface
// now renders the one Header — which is also why the old `alwaysShow` prop went with
// it: nothing needs to override the desktop-only avatar any more.
//
// `useAuthUser` is exported because Header still needs the same values for its
// mobile drawer. Resolving auth twice on one page is fine — both calls read the
// browser client's local session, which is synchronous and networkless.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LABELS } from '@/lib/labels'
import ConnectionBadge from '@/components/account/ConnectionBadge'
import ActivityMenu from '@/components/ActivityMenu'
import { buttonVariants } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, MenuItem, MenuLabel, MenuDivider } from '@/components/ui/Menu'
import { ChevronDownIcon, DownloadIcon, EnvelopeIcon } from '@/components/icons'

/** A one-path outline icon. Menu rows size + colour it (`[&_svg]` in MenuItem), so no classes here. */
function PathIcon({ d }: { d: string }) {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  )
}

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
 * @param withBell Render the notifications bell alongside the avatar.
 *
 * ⚠️ THE BELL IS NOT INSIDE `vis`, and that's deliberate. The avatar trigger is
 * `hidden md:block` because the Header's hamburger drawer repeats every LINK this menu
 * holds — but an unread COUNT is not a link, and a badge you must open a drawer to see
 * is a badge that doesn't work. So the bell renders at every width and the avatar
 * doesn't. Don't "fix" the asymmetry by adding a second mobile-only bell in Header:
 * that ships two bells in one row (tried 2026-08-17).
 */
export default function AccountMenu({ withBell = true }: { withBell?: boolean } = {}) {
  const { username, role, avatarUrl, userId, resolved } = useAuthUser()
  const pathname = usePathname()
  const hasDashboard = role === 'author' || role === 'admin'
  const vis = 'hidden md:block'

  return (
    <>
      {withBell && username && userId && <ActivityMenu userId={userId} />}
      {!resolved ? (
        // Neutral placeholder during the first-frame auth check — matches the
        // avatar-trigger footprint (44px, square-cornered like the trigger) so a
        // signed-in user goes skeleton→avatar, never "Sign In"→avatar, and
        // logged-out sees no jarring text pop.
        <div className={`${vis} w-11 h-11 rounded-md bg-surface-raised animate-pulse`} aria-hidden />
      ) : username ? (
        // `placement="masthead"`: the panel opens on the same line as Topics and
        // Activity — 8px under the header's orange rule, flush with the right
        // gutter. Menu drops its own `relative` for that, so there must be none
        // between this trigger and the header's `relative h-16` container either.
        <Menu
          placement="masthead"
          label={LABELS.account.short}
          className={vis}
          trigger={({ open, ...triggerProps }) => (
            // The one non-IconButton trigger in the chrome (it carries a handle),
            // and the only pill it ever was: now a 44px square-cornered chip, with
            // the avatar inside staying round. Open = fill only, never geometry.
            <button
              {...triggerProps}
              aria-label="Account menu"
              className={`flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-md transition-colors ${
                open ? 'bg-surface-hover' : 'bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              <Avatar src={avatarUrl} name={username} size={32} />
              {/* SM AND UP ONLY. The handle costs up to 120px, and with the bell beside it
                  the trigger ran ~180px — which collided with the wordmark at 393px back
                  when the tools chrome kept this whole menu visible on a phone. It is also
                  redundant: the panel this button opens leads with @{username}. So the
                  trigger is avatar + chevron on a narrow screen, which is what every app
                  chrome does, and the name appears the moment there's room for it. */}
              <span className="hidden sm:inline text-sm text-prose-muted max-w-[120px] truncate">
                @{username}
              </span>
              <ChevronDownIcon className={`w-3 h-3 text-prose-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
            </button>
          )}
        >
          <MenuLabel>Signed in as</MenuLabel>
          <p className="px-3 pb-2 text-sm font-bold text-prose truncate">@{username}</p>
          <MenuDivider />
          {/* Account sits ABOVE Settings — it's the page a member actually wants,
              and it used to be reachable only by going to a settings URL. Labels via
              LABELS (Account was a hardcoded "Your Stuff" in four places; "Settings"
              is the short form because this menu already says Account). */}
          <MenuItem
            href="/account"
            icon={<PathIcon d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4 4h8M8 14h5" />}
          >
            {LABELS.account.short}
          </MenuItem>
          <MenuItem
            href="/account/settings"
            icon={<PathIcon d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
          >
            {LABELS.settings.short}
          </MenuItem>
          <MenuItem
            href="/account/connections"
            icon={<PathIcon d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m10-4.63a3 3 0 11-6 0 3 3 0 016 0z" />}
          >
            {LABELS.contacts.short}
            <ConnectionBadge />
          </MenuItem>
          <MenuItem href="/account/messages" icon={<EnvelopeIcon />}>
            {LABELS.messages.short}
          </MenuItem>
          {hasDashboard && (
            <MenuItem
              href="/dashboard"
              icon={<PathIcon d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />}
            >
              Dashboard
            </MenuItem>
          )}
          <MenuItem href="/install" icon={<DownloadIcon />}>
            {LABELS.app.short}
          </MenuItem>
          <MenuDivider />
          {/* A real form POST (the signout route clears the session cookies and
              redirects). `type="submit"` is the one MenuItem that does NOT close the
              panel: closing unmounts this form mid-submit and the POST never leaves.
              The navigation that follows closes it. */}
          <form action="/api/auth/signout" method="POST">
            <MenuItem
              type="submit"
              icon={<PathIcon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />}
            >
              Sign Out
            </MenuItem>
          </form>
        </Menu>
      ) : (
        // Join is the visitor's reason to sign up — "Sign In" alone only speaks
        // to people who already have an account.
        <div className="hidden md:flex items-center gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center min-h-11 text-sm px-3 rounded-lg text-prose-muted hover:text-prose transition-colors"
          >
            Sign In
          </Link>
          <Link
            href={`/register?next=${encodeURIComponent(pathname)}`}
            className={buttonVariants({ size: 'sm' })}
          >
            Join free
          </Link>
        </div>
      )}
    </>
  )
}
