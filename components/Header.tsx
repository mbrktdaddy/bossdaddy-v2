'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/',        label: 'Home' },
  { href: '/reviews', label: 'Reviews' },
  { href: '/guides',  label: 'Guides' },
  { href: '/gear',    label: 'Gear' },
  { href: '/about',   label: 'About' },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [username, setUsername]     = useState<string | null>(null)
  const pathname = usePathname()
  const router   = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setUsername(null); return }
      supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()
        .then(({ data }) => setUsername(data?.username ?? user.email?.split('@')[0] ?? 'Account'))
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) { setUsername(null); return }
      supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .single()
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

  return (
    <header className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/60">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

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
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <form action="/search" className="hidden md:flex items-center">
            <div className="relative">
              <input
                name="q"
                type="search"
                placeholder="Search..."
                className="w-36 lg:w-48 pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-800 hover:border-gray-700 focus:border-orange-500 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </form>

          {username ? (
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/dashboard/profile"
                className="text-sm px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-900 transition-colors"
              >
                @{username}
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-colors"
              >
                Sign Out
              </button>
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

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-950">
          <div className="px-4 pt-3">
            <form action="/search">
              <div className="relative">
                <input
                  name="q"
                  type="search"
                  placeholder="Search reviews and guides..."
                  className="w-full pl-8 pr-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
                />
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>
          </div>
          <nav className="flex flex-col px-4 py-3 gap-1">
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
            {username ? (
              <>
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileOpen(false)}
                  className="mt-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-900 transition-colors"
                >
                  @{username}
                </Link>
                <button
                  onClick={() => { setMobileOpen(false); handleSignOut() }}
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-center border border-gray-700 text-gray-400 hover:border-red-700 hover:text-red-400 transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                onClick={() => setMobileOpen(false)}
                className="mt-2 px-4 py-3 rounded-xl text-sm font-semibold text-center bg-orange-600 hover:bg-orange-500 text-white transition-colors"
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
