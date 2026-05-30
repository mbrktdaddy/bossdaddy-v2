'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import CartIcon from '@/components/CartIcon'
import CategoryIcon from '@/components/CategoryIcon'
import ActivityMenu from '@/components/ActivityMenu'
import InstallAppButton from '@/components/pwa/InstallAppButton'

interface HeaderProps {
  /** The current user's username, or null if not signed in. Resolved server-side
   *  in the (public) layout so the Header doesn't need the Supabase client and
   *  the auth/postgrest libs stay out of the public bundle. */
  username: string | null
  /** The current user's role, or null if not signed in. Used to route account
   *  links — members go to /account/settings, authors/admins to /dashboard/profile. */
  role?: string | null
  /** Avatar URL from profiles.avatar_url, or null. When present, replaces the
   *  initial-fallback circle in both the desktop user menu trigger and the
   *  mobile drawer. */
  avatarUrl?: string | null
  /** The current user's id, or null. Forwarded to the realtime header menus so
   *  they subscribe synchronously without an async getUser() round-trip. */
  userId?: string | null
}

// Vault is intentionally NOT a top-level anchor — its contents
// (Comparisons / Best Of / Stacks / Gift Guides) live inside the Browse
// mega-menu's "From The Vault" section, and that menu's "See all →" link
// is the canonical path to /vault itself.
const NAV_LINKS = [
  { href: '/',        label: 'Home' },
  { href: '/reviews', label: LABELS.reviews.plural },
  { href: '/guides',  label: LABELS.guides.plural },
  { href: '/gear',    label: LABELS.gear.short },
  { href: '/tools',   label: LABELS.tools.short },
]

// Sub-links surfaced in the "Browse" mega-menu footer + mobile drawer.
// Source of truth for which collection types are user-visible in nav.
const VAULT_LINKS = [
  {
    href: '/comparisons',
    label: 'Comparisons',
    blurb: 'Head-to-head scorecards',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
      </svg>
    ),
  },
  {
    href: '/picks',
    label: 'Best Of',
    blurb: 'Curated picks',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    href: '/stacks',
    label: 'Stacks',
    blurb: 'Kits built for purpose',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: '/gifts',
    label: 'Gift Guides',
    blurb: 'Real-tested ideas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function Header({ username, role, avatarUrl, userId }: HeaderProps) {
  // Members go to /account/settings; authors and admins go to /dashboard/profile.
  const profileHref = (role === 'author' || role === 'admin') ? '/dashboard/profile' : '/account/settings'
  const hasDashboard = role === 'author' || role === 'admin'

  const [mobileOpen, setMobileOpen]   = useState(false)
  const [catOpen, setCatOpen]         = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [mobileCatOpen, setMobileCat] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname    = usePathname()
  const browseRef   = useRef<HTMLDivElement>(null)
  const searchRef   = useRef<HTMLInputElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [])

  // Close mega-menu on outside click or Escape
  useEffect(() => {
    if (!catOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setCatOpen(false) }
    function onMouse(e: MouseEvent) {
      if (browseRef.current && !browseRef.current.contains(e.target as Node)) setCatOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouse)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onMouse) }
  }, [catOpen])

  // Close user menu on outside click or Escape
  useEffect(() => {
    if (!userMenuOpen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setUserMenuOpen(false) }
    function onMouse(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onMouse)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onMouse) }
  }, [userMenuOpen])

  // Cmd/Ctrl+K opens desktop search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openSearch])

  // Close menus on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); setCatOpen(false); setSearchOpen(false); setUserMenuOpen(false) }, [pathname])

  const isCategoryActive = pathname.startsWith('/reviews/category') || pathname.startsWith('/guides/category') || pathname.startsWith('/category/')

  return (
    <header className="sticky top-0 z-50 bg-drama/95 backdrop-blur-md border-b border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight shrink-0">
          <Image
            src="/images/bd-logo-icon.png"
            alt="Boss Daddy"
            width={36}
            height={36}
            priority
            className="h-9 w-9 object-contain"
          />
          <span>
            <span className="text-accent-brand">BOSS</span>
            <span className="text-zinc-100"> DADDY</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Site navigation" className="hidden md:flex items-center gap-1">
          {/* Home omitted on desktop — the logo is the home affordance. Kept in
              the mobile drawer (conventional there). */}
          {NAV_LINKS.filter((l) => l.href !== '/').map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(pathname, href)
                  ? 'bg-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'
              }`}
            >
              {label}
            </Link>
          ))}

          {/* Browse mega-menu trigger */}
          <div ref={browseRef} className="relative">
            <button
              onClick={() => setCatOpen(!catOpen)}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                catOpen || isCategoryActive
                  ? 'bg-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'
              }`}
            >
              Browse
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Mega-menu panel — elevated zinc-800 to lift from masthead */}
            {catOpen && (
              <div className="absolute right-0 top-full mt-2 w-[580px] bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl shadow-black/5 p-5 z-50">
                <p className="text-xs text-copper uppercase tracking-widest font-semibold mb-4">Browse by Category</p>
                <div className="grid grid-cols-2 gap-1">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      onClick={() => setCatOpen(false)}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-zinc-700 transition-colors group"
                    >
                      <CategoryIcon slug={cat.slug} className="w-6 h-6 text-copper mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-zinc-100 group-hover:text-zinc-50 transition-colors leading-tight">
                          {cat.label}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">{cat.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                {/* The Vault — sibling discovery section for collection types */}
                <div className="mt-5 pt-4 border-t border-zinc-700">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-copper uppercase tracking-widest font-semibold">From {LABELS.vault.full}</p>
                    <Link
                      href="/vault"
                      onClick={() => setCatOpen(false)}
                      className="text-xs text-zinc-400 hover:text-copper font-semibold transition-colors"
                    >
                      See all →
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {VAULT_LINKS.map((v) => (
                      <Link
                        key={v.href}
                        href={v.href}
                        onClick={() => setCatOpen(false)}
                        className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zinc-700 transition-colors group"
                      >
                        <span className="text-copper mt-0.5 shrink-0">{v.icon}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-zinc-100 group-hover:text-zinc-50 transition-colors leading-tight">{v.label}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{v.blurb}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {/* Search — icon by default, expands on click. Dark recessed surface. */}
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <form
                action="/search"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setSearchOpen(false)
                }}
              >
                <div className="relative">
                  <input
                    ref={searchRef}
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder="Search..."
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false) }}
                    className="w-44 lg:w-56 pl-8 pr-3 py-1.5 bg-zinc-800 border border-zinc-700 focus:border-copper focus-visible:ring-1 focus-visible:ring-copper/50 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-500 focus:outline-none transition-colors"
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>
            ) : (
              <>
                <button
                  onClick={openSearch}
                  aria-label="Search"
                  aria-keyshortcuts="Meta+K Ctrl+K"
                  className="hidden lg:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-50 hover:border-zinc-600 transition-colors text-sm"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-xs text-zinc-400">Search</span>
                  <kbd className="text-[10px] font-mono bg-zinc-700 border border-zinc-600 rounded px-1.5 py-0.5 leading-none">⌘K</kbd>
                </button>
                <button
                  onClick={openSearch}
                  aria-label="Search"
                  aria-keyshortcuts="Meta+K Ctrl+K"
                  className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <CartIcon />

          {username && userId && <ActivityMenu userId={userId} />}

          {username ? (
            <div ref={userMenuRef} className="hidden md:block relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-colors ${
                  userMenuOpen ? 'bg-zinc-700' : 'bg-zinc-800 hover:bg-zinc-700'
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
                <span className="text-sm text-zinc-300 max-w-[120px] truncate">@{username}</span>
                <svg
                  className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl shadow-black/5 p-1.5 z-50">
                  <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Signed in as</p>
                    <p className="text-sm font-bold text-zinc-100 truncate">@{username}</p>
                  </div>
                  <Link
                    href={profileHref}
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {hasDashboard ? 'Profile' : 'Account Settings'}
                  </Link>
                  {hasDashboard && (
                    <Link
                      href="/dashboard"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-50 transition-colors"
                    >
                      <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />
                      </svg>
                      Dashboard
                    </Link>
                  )}
                  <InstallAppButton variant="menu" className="px-3 py-2 rounded-xl" />
                  <div className="border-t border-zinc-800 mt-1 pt-1">
                    <form action="/api/auth/signout" method="POST">
                      <button
                        type="submit"
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-300 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
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
              className="hidden md:block text-sm px-4 py-2 rounded-lg border border-zinc-700 text-zinc-300 hover:border-copper hover:text-zinc-50 transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-3 rounded-lg text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/60 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile search bar — dark recessed surface */}
      <div className={`md:hidden px-4 pb-3 ${pathname === '/search' ? 'hidden' : ''}`}>
        <form action="/search">
          <div className="relative">
            <input
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search reviews and guides..."
              className="w-full pl-9 pr-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-base text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:border-copper focus-visible:ring-1 focus-visible:ring-copper/50 transition-colors"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>
      </div>

      {/* Mobile drawer — dark to match nav.
          max-h subtracts the 4rem sticky header AND the iOS safe-area
          inset (home indicator on iPhone, address bar on some browsers)
          so the last items aren't hidden behind browser chrome.
          The trailing pb-[env(safe-area-inset-bottom)] pads the inner
          content for the same reason on devices where the safe area is
          a real cutout. */}
      {mobileOpen && (
        <div
          className="md:hidden border-t border-zinc-800 bg-drama overflow-y-auto"
          style={{
            maxHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* Main nav links */}
          <nav aria-label="Mobile navigation" className="flex flex-col px-4 pt-3 gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(pathname, href)
                    ? 'bg-accent text-white'
                    : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Browse by Category — mobile primary discovery */}
          <div className="px-4 pt-5 pb-2">
            <button
              onClick={() => setMobileCat(!mobileCatOpen)}
              className="flex items-center justify-between w-full text-xs text-copper uppercase tracking-widest font-semibold mb-3"
            >
              Browse by Category
              <svg
                className={`w-4 h-4 transition-transform ${mobileCatOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {mobileCatOpen && (
              <div className="grid grid-cols-2 gap-2 pb-3">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      pathname === `/category/${cat.slug}`
                        ? 'bg-accent text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:text-zinc-50 hover:bg-zinc-700'
                    }`}
                  >
                    <CategoryIcon slug={cat.slug} className="w-4 h-4 text-copper" />
                    <span className="truncate">{cat.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* From The Vault — collection types as a 2x2 grid */}
          <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-copper uppercase tracking-widest">From {LABELS.vault.full}</p>
              <Link
                href="/vault"
                onClick={() => setMobileOpen(false)}
                className="text-xs text-zinc-400 hover:text-copper font-semibold transition-colors"
              >
                See all →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VAULT_LINKS.map((v) => (
                <Link
                  key={v.href}
                  href={v.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition-colors min-h-[44px]"
                >
                  <span className="text-copper shrink-0">{v.icon}</span>
                  <span className="text-xs font-semibold text-zinc-300 truncate">{v.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Auth / account */}
          <div className="px-4 pb-4 border-t border-zinc-800 pt-3 mt-1">
            {username ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-accent flex items-center justify-center text-base font-bold text-white shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={40} height={40} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      username[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">Signed in as</p>
                    <p className="text-sm font-bold text-zinc-100 truncate">@{username}</p>
                  </div>
                </div>
                <Link
                  href={profileHref}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 transition-colors"
                >
                  <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {hasDashboard ? 'Profile' : 'Account Settings'}
                </Link>
                {hasDashboard && (
                  <Link
                    href="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-zinc-300 hover:text-zinc-50 hover:bg-zinc-800 transition-colors"
                  >
                    <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />
                    </svg>
                    Dashboard
                  </Link>
                )}
                <InstallAppButton variant="menu" className="px-4 py-3 rounded-xl" />
                <form action="/api/auth/signout" method="POST" className="mt-1">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-300 hover:bg-red-50 hover:text-red-700 transition-colors text-left border-t border-zinc-800 pt-3"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign Out
                  </button>
                </form>
              </div>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-semibold text-center bg-accent hover:bg-accent-hover text-white transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
