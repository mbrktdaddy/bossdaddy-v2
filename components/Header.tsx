'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import CartIcon from '@/components/CartIcon'
import CategoryIcon from '@/components/CategoryIcon'
import AccountMenu, { useAuthUser } from '@/components/AccountMenu'
import ConnectionBadge from '@/components/account/ConnectionBadge'
import { isImmersiveRoute } from '@/lib/immersive-routes'
import { buttonVariants } from '@/components/ui/Button'
import { BagIcon, ChevronDownIcon, ChevronRightIcon, CubeIcon, EnvelopeIcon, ScaleIcon, SearchIcon, StarIcon, XIcon } from '@/components/icons'

// Vault is intentionally NOT a top-level anchor — its contents
// (Comparisons / Best Of / Stacks / Gift Guides) live inside the Browse
// mega-menu's "From The Vault" section, and that menu's "See all →" link
// is the canonical path to /vault itself.
//
// ⚠️ CANONICAL SPINE ORDER: Reviews · Guides · Tools · Gear. Every surface that lists
// these four renders them in this sequence — this array (which feeds BOTH the desktop
// nav and the mobile drawer), `MobileBottomNav`'s tabs, and the Footer's Browse column.
// Tools used to sit last here and last in the footer, which put the most-used signed-in
// surface at the end of every list on the site. If you add a fifth spine anchor, add it
// in all three places or it will read as a different site depending on where you look.
//
// DESKTOP EXCEPTION (2026-10-08, operator decision): the desktop bar splits by
// audience — Topics · Reviews · Guides · Gear on the left (the publication), Tools
// on the right beside the account (the members' home). The drawer keeps this order.
//
// ONE SANCTIONED EXCEPTION: `MobileBottomNav` carries Home · Reviews · [Ask] · Guides ·
// Tools — it has five slots and the elevated Ask FAB owns the middle one, so Gear is
// deliberately absent there and reaches mobile through THIS array's drawer instead. That
// is an operator decision (2026-08-17), not drift — don't "restore" Gear to the strip
// without cutting another tab. Reasoning is in `MobileBottomNav.tsx`.
const NAV_LINKS = [
  { href: '/',        label: 'Home' },
  { href: '/reviews', label: LABELS.reviews.plural },
  { href: '/guides',  label: LABELS.guides.plural },
  { href: '/tools',   label: LABELS.tools.short },
  { href: '/gear',    label: LABELS.gear.short },
]

// The mobile drawer's own links: only the spine anchors the bottom tab strip
// does NOT carry (it has Home · Reviews · Guides · Tools). Today that's Gear.
const DRAWER_LINKS = NAV_LINKS.filter((l) => ['/gear'].includes(l.href))

// Sub-links surfaced in the "Browse" mega-menu footer + mobile drawer.
// Source of truth for which collection types are user-visible in nav.
const VAULT_LINKS = [
  {
    href: '/comparisons',
    label: LABELS.comparisons.short,
    blurb: 'Head-to-head scorecards',
    icon: (
      <ScaleIcon className="w-4 h-4" strokeWidth={1.5} />
    ),
  },
  {
    href: '/picks',
    label: LABELS.picks.short,
    blurb: 'Ranked category roundups',
    icon: (
      <StarIcon className="w-4 h-4" strokeWidth={1.5} />
    ),
  },
  {
    href: '/stacks',
    label: LABELS.stacks.short,
    blurb: 'Kits built for purpose',
    icon: (
      <CubeIcon className="w-4 h-4" strokeWidth={1.5} />
    ),
  },
  {
    href: '/gifts',
    label: LABELS.gifts.short,
    blurb: 'Real-tested ideas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
]

// "From Boss Daddy" — the Browse menu's third column: places that are Boss
// Daddy's own (the gear pipeline + the store), as opposed to topics (column 1)
// or content formats (column 2). Each column is ONE kind of thing, and all three
// get the same heading weight — the old menu stacked these as two small rows
// under two dividers, which read as an afterthought.
const BOSS_LINKS = [
  {
    href: '/gear/radar',
    label: LABELS.radar.full,
    short: LABELS.radar.short,
    blurb: 'Spotted, not yet tested',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l6-6M21 12a9 9 0 11-9-9m5 9a5 5 0 11-5-5" />
      </svg>
    ),
  },
  {
    href: '/bench',
    label: LABELS.bench.full,
    short: LABELS.bench.short,
    blurb: 'Testing now — follow along',
    icon: <span aria-hidden className="block w-2 h-2 m-1 rounded-full bg-accent animate-pulse" />,
  },
  {
    href: '/shop',
    label: LABELS.shop.full,
    short: LABELS.shop.short,
    blurb: 'Apparel, drinkware, accessories',
    icon: <BagIcon className="w-4 h-4" strokeWidth={1.5} />,
  },
]

// One heading style for every Browse group, desktop and mobile alike.
const MENU_HEADING = 'text-xs text-copper uppercase tracking-widest font-semibold'

// Pages that live inside the Browse menu — the trigger lights up on these.
const BROWSE_PREFIXES = ['/category/', '/reviews/category', '/guides/category', '/vault', '/comparisons', '/picks', '/stacks', '/gifts', '/bench', '/shop']

const TOOLS_HREF = '/tools'

// Mirrors MobileBottomNav's Tools `match`: /goals and /today belong to Tools; the
// Boss (/tools/the-boss) belongs to Ask.
function isToolsActive(pathname: string) {
  if (pathname.startsWith('/tools/the-boss')) return false
  return ['/tools', '/goals', '/today'].some((p) => pathname.startsWith(p))
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

function BrowseRow({ href, label, blurb, icon, onNavigate }: {
  href: string; label: string; blurb: string; icon: ReactNode; onNavigate: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-start gap-2.5 p-2.5 -mx-1 rounded-xl hover:bg-surface-hover transition-colors min-h-[44px]"
    >
      <span className="text-copper mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold text-prose leading-tight">{label}</p>
        <p className="text-xs text-prose-muted mt-0.5 line-clamp-1">{blurb}</p>
      </div>
    </Link>
  )
}

export default function Header() {
  const { username, role, avatarUrl } = useAuthUser()
  const hasDashboard = role === 'author' || role === 'admin'

  const [mobileOpen, setMobileOpen]   = useState(false)
  const [catOpen, setCatOpen]         = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const [mobileCatOpen, setMobileCat] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
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
  useEffect(() => { setMobileOpen(false); setCatOpen(false); setSearchOpen(false); setMobileSearchOpen(false); setUserMenuOpen(false) }, [pathname])

  // Masthead floats transparent over the homepage hero, then solidifies once
  // the user scrolls past the top. Only the homepage has a full-bleed hero
  // behind the nav — every other page is solid from the top.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isBrowseActive = BROWSE_PREFIXES.some((p) => pathname.startsWith(p))

  // Homepage masthead floats transparent over the hero until the user scrolls.
  const transparent = pathname === '/' && !scrolled

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        transparent
          ? 'bg-transparent border-b border-transparent'
          : 'bg-chrome/95 backdrop-blur-md border-b border-soft'
      }`}
    >
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight shrink-0">
          <Image
            src="/images/bd-logo-icon.png"
            alt="" /* decorative: the link's text already names it — an alt here gets read twice */
            width={36}
            height={36}
            priority
            className="h-9 w-9 object-contain"
          />
          <span>
            <span className="text-accent-brand">BOSS</span>
            <span className="text-prose"> DADDY</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {/* Desktop splits by AUDIENCE: the publication sits here on the left —
            Topics first, then Reviews · Guides · Gear — and Tools (the members'
            home) sits on the right with the account. Home is omitted (the logo
            is the home affordance); the mobile drawer keeps the full spine. */}
        <nav aria-label="Site navigation" className="hidden md:flex items-center gap-1">
          {/* Topics mega-menu trigger — first, because readers navigate by
              subject. NOT `relative`: the panel anchors to the header container
              so its full width never runs off-screen at md. */}
          <div ref={browseRef}>
            <button
              onClick={() => setCatOpen(!catOpen)}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                catOpen || isBrowseActive
                  ? 'bg-accent text-white'
                  : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
              }`}
            >
              Topics
              <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${catOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>

            {/* Mega-menu panel — three columns, ONE kind of thing per column,
                equal heading weight: Topics · Collections · From Boss Daddy. */}
            {catOpen && (
              <div className="absolute right-4 sm:right-6 top-full mt-2 w-[min(860px,calc(100%-3rem))] bg-surface-raised border border-strong rounded-xl p-6 z-50 grid grid-cols-[1.6fr_1fr_1fr] gap-6">
                <div>
                  <p className={`${MENU_HEADING} mb-3`}>Topics</p>
                  <div className="grid grid-cols-2 gap-x-2">
                    {CATEGORIES.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        onClick={() => setCatOpen(false)}
                        className="flex items-center gap-2.5 px-2.5 py-2 -mx-1 rounded-xl hover:bg-surface-hover transition-colors min-h-[44px]"
                      >
                        <CategoryIcon slug={cat.slug} className="w-5 h-5 text-copper shrink-0" />
                        <span className="text-sm font-semibold text-prose leading-tight">{cat.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="border-l border-strong pl-6">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className={MENU_HEADING}>Collections</p>
                    <Link
                      href="/vault"
                      onClick={() => setCatOpen(false)}
                      className="text-xs text-prose-muted hover:text-copper font-semibold transition-colors"
                    >
                      {LABELS.vault.full} →
                    </Link>
                  </div>
                  {VAULT_LINKS.map((v) => (
                    <BrowseRow key={v.href} {...v} onNavigate={() => setCatOpen(false)} />
                  ))}
                </div>

                <div className="border-l border-strong pl-6">
                  <p className={`${MENU_HEADING} mb-3`}>From Boss Daddy</p>
                  {BOSS_LINKS.map((b) => (
                    <BrowseRow key={b.href} {...b} onNavigate={() => setCatOpen(false)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.filter((l) => l.href !== '/' && l.href !== TOOLS_HREF).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(pathname, href)
                  ? 'bg-accent text-white'
                  : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {/* Search — ⌘K pill (Clean masthead), expands to an input on click. */}
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
                    className="w-44 lg:w-56 pl-8 pr-3 py-1.5 bg-surface-raised border border-strong focus:border-copper focus-visible:ring-1 focus-visible:ring-copper/50 rounded-lg text-sm text-prose placeholder:text-prose-faint focus:outline-none transition-colors"
                  />
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-prose-faint" strokeWidth={2} />
                </div>
              </form>
            ) : (
              <button
                onClick={openSearch}
                aria-label="Search"
                aria-keyshortcuts="Meta+K Ctrl+K"
                className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg bg-surface-raised border border-strong text-prose-muted hover:text-prose hover:border-zinc-600 transition-colors text-sm"
              >
                <SearchIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                <span className="hidden lg:inline text-xs text-prose-muted">Search</span>
                <kbd className="text-[10px] font-mono bg-surface-hover border border-zinc-600 rounded px-1.5 py-0.5 leading-none">⌘K</kbd>
              </button>
            )}
          </div>

          {/* Tools — the members' home (Today, goals, savings) plus the public
              calculators. Right side, with the account, because it's "yours"
              rather than the publication. Same glyph as the mobile Tools tab. */}
          <Link
            href={TOOLS_HREF}
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isToolsActive(pathname) ? 'text-prose' : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <rect x="3" y="8.25" width="18" height="12" rx="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25V6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75v1.5M3 13.5h6v1.5a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75v-1.5h6" />
            </svg>
            <span className="sr-only lg:not-sr-only">{LABELS.tools.short}</span>
          </Link>

          {/* Shop — the store's standing entry point, where every major site keeps
              it: top-right, beside the cart. Not a spine anchor (merch is
              secondary), and the cart icon still only appears once it has items. */}
          <Link
            href="/shop"
            className={`hidden md:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive(pathname, '/shop') ? 'text-prose' : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
            }`}
          >
            <BagIcon className="w-4 h-4" strokeWidth={1.5} />
            <span className="sr-only lg:not-sr-only">{LABELS.shop.short}</span>
          </Link>

          <CartIcon />

          <AccountMenu />

          {/* NO SEPARATE MOBILE BELL HERE, and don't add one: `AccountMenu` renders
              ActivityMenu OUTSIDE its own `hidden md:block` wrapper (see that file), so
              the bell already shows at every width while the avatar trigger stays
              desktop-only. Adding a second one for "mobile" puts two bells in the row. */}

          {/* Mobile search — an icon that opens the search row, instead of a
              permanent field on every page (it made the mobile header ~7.5rem). */}
          {!isImmersiveRoute(pathname) && pathname !== '/search' && (
            <button
              onClick={() => {
                const next = !mobileSearchOpen
                setMobileSearchOpen(next)
                setMobileOpen(false)
                if (next) setTimeout(() => mobileSearchRef.current?.focus(), 50)
              }}
              aria-label={mobileSearchOpen ? 'Close search' : 'Search'}
              aria-expanded={mobileSearchOpen}
              className="md:hidden p-3 rounded-lg text-prose-muted hover:text-prose hover:bg-surface-raised/60 transition-colors"
            >
              {mobileSearchOpen ? <XIcon className="w-5 h-5" strokeWidth={2} /> : <SearchIcon className="w-5 h-5" strokeWidth={2} />}
            </button>
          )}

          {/* Hamburger */}
          <button
            onClick={() => { setMobileOpen(!mobileOpen); setMobileSearchOpen(false) }}
            className="md:hidden p-3 rounded-lg text-prose-muted hover:text-prose hover:bg-surface-raised/60 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <XIcon className="w-5 h-5" strokeWidth={2} />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile search row — opened by the header's search icon, closed by
          default. NEVER on immersive routes (the DM thread): an app-like surface
          carries minimal chrome, and that fixed-height surface's CSS fallback
          assumes a 4rem header — this row would push its composer off-screen. */}
      {mobileSearchOpen && !isImmersiveRoute(pathname) && (
      <div className="md:hidden px-4 pb-3">
        <form action="/search">
          <div className="relative">
            <input
              ref={mobileSearchRef}
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search reviews and guides..."
              className="w-full pl-9 pr-3 py-2.5 bg-surface-raised border border-strong rounded-xl text-base text-prose placeholder:text-prose-faint focus:outline-none focus:border-copper focus-visible:ring-1 focus-visible:ring-copper/50 transition-colors"
            />
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-prose-faint" strokeWidth={2} />
          </div>
        </form>
      </div>
      )}

      {/* Mobile drawer — dark to match nav.
          max-h subtracts the 4rem sticky header AND the iOS safe-area
          inset (home indicator on iPhone, address bar on some browsers)
          so the last items aren't hidden behind browser chrome.
          The trailing pb-[env(safe-area-inset-bottom)] pads the inner
          content for the same reason on devices where the safe area is
          a real cutout. */}
      {mobileOpen && (
        <div
          className="md:hidden border-t border-soft bg-chrome overflow-y-auto"
          style={{
            maxHeight: 'calc(100dvh - 4rem - env(safe-area-inset-bottom))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* The drawer holds ONLY what the bottom tab strip doesn't. Home ·
              Reviews · Guides · Tools are one tap away down there, so repeating
              them here just doubled the list. Gear is the one spine anchor the
              strip omits, so it leads. Get the App moved to InstallPrompt — a
              one-time nudge beats a permanent row. */}
          <nav aria-label="Mobile navigation" className="px-4 pt-3">
            {DRAWER_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(pathname, href)
                    ? 'bg-accent text-white'
                    : 'text-prose hover:bg-surface-raised'
                }`}
              >
                {label}
                <ChevronRightIcon className="w-4 h-4 text-prose-faint" strokeWidth={2} />
              </Link>
            ))}
          </nav>

          {/* Browse — the same three groups as the desktop mega-menu, same
              heading style. Topics stays collapsible (10 rows); the other two
              are short enough to show open. */}
          <div className="px-4 pt-5 pb-2 border-t border-soft mt-3">
            <button
              onClick={() => setMobileCat(!mobileCatOpen)}
              aria-expanded={mobileCatOpen}
              className={`flex items-center justify-between w-full min-h-[44px] ${MENU_HEADING}`}
            >
              Topics
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${mobileCatOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {mobileCatOpen && (
              <div className="grid grid-cols-2 gap-2 pt-1 pb-3">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/category/${cat.slug}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      pathname === `/category/${cat.slug}`
                        ? 'bg-accent text-white'
                        : 'bg-surface-raised text-prose-muted hover:text-prose hover:bg-surface-hover'
                    }`}
                  >
                    <CategoryIcon slug={cat.slug} className="w-4 h-4 text-copper" />
                    <span className="truncate">{cat.label}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-soft pt-4">
            <div className="flex items-baseline justify-between mb-2">
              <p className={MENU_HEADING}>Collections</p>
              <Link
                href="/vault"
                onClick={() => setMobileOpen(false)}
                className="py-2 text-xs text-prose-muted hover:text-copper font-semibold transition-colors"
              >
                {LABELS.vault.full} →
              </Link>
            </div>
            {/* Compact tiles, not blurb rows — a phone can't afford two lines each. */}
            <div className="grid grid-cols-2 gap-2">
              {VAULT_LINKS.map((v) => (
                <Link key={v.href} href={v.href} onClick={() => setMobileOpen(false)} className={buttonVariants({ variant: 'secondary' })}>
                  <span className="text-copper shrink-0">{v.icon}</span>
                  <span className="text-xs font-semibold text-prose-muted truncate">{v.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="px-4 pb-4 border-t border-soft pt-4">
            <p className={`${MENU_HEADING} mb-2`}>From Boss Daddy</p>
            <div className="grid grid-cols-3 gap-2">
              {BOSS_LINKS.map((b) => (
                <Link key={b.href} href={b.href} onClick={() => setMobileOpen(false)} className={buttonVariants({ variant: 'secondary', className: 'px-2' })}>
                  <span className="text-copper shrink-0">{b.icon}</span>
                  <span className="text-xs font-semibold text-prose-muted truncate">{b.short}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Auth / account */}
          <div className="px-4 pb-4 border-t border-soft pt-3 mt-1">
            {username ? (
              // One row for the account, not seven. Settings and Connections are
              // linked from /account itself, so the drawer only needs the door in;
              // the pending-requests badge rides on that row so it isn't lost.
              // Messages keeps its own tile — it's the one people want fast.
              <div className="flex flex-col gap-2">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-raised transition-colors"
                >
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-accent flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {avatarUrl ? (
                      <Image src={avatarUrl} alt="" width={36} height={36} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      username[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-prose truncate">@{username}</p>
                    <p className="text-xs text-prose-muted">{LABELS.account.short}</p>
                  </div>
                  <ConnectionBadge />
                  <ChevronRightIcon className="w-4 h-4 text-prose-faint shrink-0" strokeWidth={2} />
                </Link>
                <div className={`grid gap-2 ${hasDashboard ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <Link href="/account/messages" onClick={() => setMobileOpen(false)} className={buttonVariants({ variant: 'secondary', className: 'px-2' })}>
                    <EnvelopeIcon className="w-4 h-4 text-copper shrink-0" strokeWidth={1.8} />
                    <span className="text-xs font-semibold text-prose-muted">Messages</span>
                  </Link>
                  {hasDashboard && (
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className={buttonVariants({ variant: 'secondary', className: 'px-2' })}>
                      <span className="text-xs font-semibold text-prose-muted">Dashboard</span>
                    </Link>
                  )}
                  <form action="/api/auth/signout" method="POST" className="contents">
                    <button type="submit" className={buttonVariants({ variant: 'secondary', className: 'px-2' })}>
                      <span className="text-xs font-semibold text-prose-muted">Sign Out</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/register?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                  className={buttonVariants()}>
                  Join free
                </Link>
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                  className={buttonVariants({ variant: 'secondary' })}>
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
