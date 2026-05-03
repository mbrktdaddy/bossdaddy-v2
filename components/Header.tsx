'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/lib/categories'

const NAV_LINKS = [
  { href: '/',        label: 'Home' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/guides',  label: 'Guides' },
  { href: '/stuff',   label: 'Stuff' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function Header() {
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [catOpen, setCatOpen]         = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [username, setUsername]       = useState<string | null>(null)
  const [mobileCatOpen, setMobileCat] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const pathname    = usePathname()
  const router      = useRouter()
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

  // Close menus on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileOpen(false); setCatOpen(false); setSearchOpen(false); setUserMenuOpen(false) }, [pathname])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setUsername(null); return }
      supabase.from('profiles').select('username').eq('id', user.id).single()
        .then(({ data }) => setUsername(data?.username ?? user.email?.split('@')[0] ?? 'Account'))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) { setUsername(null); return }
      supabase.from('profiles').select('username').eq('id', session.user.id).single()
        .then(({ data }) => setUsername(data?.username ?? session.user.email?.split('@')[0] ?? 'Account'))
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isCategoryActive = pathname.startsWith('/reviews/category') || pathname.startsWith('/guides/category')

  return (
    <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="font-black text-xl tracking-tight shrink-0">
          <span className="text-orange-500">BOSS</span>
          <span className="text-white"> DADDY</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(pathname, href)
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
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
                  ? 'text-white bg-gray-800'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
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

            {/* Mega-menu panel */}
            {catOpen && (
              <div className="absolute right-0 top-full mt-2 w-[580px] bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60 p-5 z-50">
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Browse by Category</p>
                <div className="grid grid-cols-2 gap-1">
                  {CATEGORIES.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      onClick={() => setCatOpen(false)}
                      className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-900 transition-colors group"
                    >
                      <span className="text-2xl leading-none mt-0.5">{cat.icon}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors leading-tight">
                          {cat.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{cat.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between">
                  <Link
                    href="/reviews"
                    onClick={() => setCatOpen(false)}
                    className="text-xs text-orange-500 hover:text-orange-400 font-semibold transition-colors"
                  >
                    All reviews →
                  </Link>
                  <Link
                    href="/guides"
                    onClick={() => setCatOpen(false)}
                    className="text-xs text-gray-500 hover:text-gray-300 font-semibold transition-colors"
                  >
                    All guides →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Search — icon by default, expands on click */}
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
                    placeholder="Search..."
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false) }}
                    className="w-44 lg:w-56 pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 focus:border-orange-500 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </form>
            ) : (
              <button
                onClick={openSearch}
                aria-label="Search"
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
          </div>

          {username ? (
            <div ref={userMenuRef} className="hidden md:block relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-colors ${
                  userMenuOpen ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'
                }`}
                aria-label="Account menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-7 h-7 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {username[0].toUpperCase()}
                </div>
                <span className="text-sm text-gray-300 max-w-[120px] truncate">@{username}</span>
                <svg
                  className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/60 p-1.5 z-50">
                  <div className="px-3 py-2 border-b border-gray-800/60 mb-1">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Signed in as</p>
                    <p className="text-sm font-bold text-white truncate">@{username}</p>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-gray-900 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:bg-gray-900 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />
                    </svg>
                    Dashboard
                  </Link>
                  <div className="border-t border-gray-800/60 mt-1 pt-1">
                    <button
                      onClick={() => { setUserMenuOpen(false); handleSignOut() }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-red-950/40 hover:text-red-400 transition-colors text-left"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="hidden md:block text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-orange-500 hover:text-white transition-colors"
            >
              Sign In
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-3 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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

      {/* Mobile search bar — always visible except on /search (which has its own) */}
      <div className={`md:hidden px-4 pb-3 ${pathname === '/search' ? 'hidden' : ''}`}>
        <form action="/search">
          <div className="relative">
            <input
              name="q"
              type="search"
              placeholder="Search reviews and guides..."
              className="w-full pl-9 pr-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950 overflow-y-auto max-h-[calc(100dvh-4rem)]">
          {/* Main nav links */}
          <nav className="flex flex-col px-4 pt-3 gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(pathname, href)
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
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
              className="flex items-center justify-between w-full text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3"
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
                        ? 'bg-orange-950/60 text-orange-400 border border-orange-900/40'
                        : 'bg-gray-900 text-gray-300 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Auth / account */}
          <div className="px-4 pb-4 border-t border-gray-800 pt-3 mt-1">
            {username ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-orange-600 flex items-center justify-center text-base font-bold text-white shrink-0">
                    {username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Signed in as</p>
                    <p className="text-sm font-bold text-white truncate">@{username}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profile
                </Link>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-900 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6v6H4zM14 6h6v4h-6zM14 14h6v4h-6zM4 16h6v2H4z" />
                  </svg>
                  Dashboard
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); handleSignOut() }}
                  className="mt-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:bg-red-950/40 hover:text-red-400 transition-colors text-left border-t border-gray-800/60 pt-3"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </div>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-semibold text-center bg-orange-600 hover:bg-orange-500 text-white transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
