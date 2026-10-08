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
import { BagIcon, ChevronDownIcon, ChevronRightIcon, EnvelopeIcon, SearchIcon, XIcon } from '@/components/icons'

// Collections (comparisons / best-of / stacks / gift guides) are NOT in this
// chrome at all (nav-ia-plan Phase I-4, 2026-10-08). They are formats, not
// places: comparisons and best-of are reached through /explore and the category
// hubs, stacks and gift guides through /gear. The Vault hub that used to sit
// over them 301s to /gear.
//
// ⚠️ THE PILLARS (nav-ia-plan Phase I, 2026-10-08): Topics · Gear · Shop · Tools.
// A nav slot goes to a TOPIC or an INTENT (gear, shop, tools, seasonal gifts) — never
// to a content FORMAT (invariant 10). Reviews and Guides used to be spine anchors
// here; they are article shapes inside Topics now, reached through the mega-menu,
// the category hubs and /explore. Every surface that lists the pillars renders them
// in this order — this bar, the Footer's Browse column, and (as Home · Explore ·
// [Ask] · Gear · Tools) `MobileBottomNav`. Add a pillar in all three places or the
// site reads differently depending on where you look.
//
// DESKTOP splits by audience: Topics ▾ · Gear · Shop on the left (the publication
// and its places), Tools on the right beside the account (the members' home).
// Home is omitted — the logo is the home affordance.
//
// MOBILE: every pillar is on the bottom strip, so the drawer below carries NO lead
// rows; it holds only the Browse groups (Topics, From Boss Daddy) and the account
// door. Reasoning is in `MobileBottomNav.tsx`.
const NAV_LINKS = [
  { href: '/gear', label: LABELS.gear.short },
  { href: '/shop', label: LABELS.shop.short },
]

// "From Boss Daddy" — the Browse menu's second column: places that are Boss
// Daddy's own (the gear pipeline + the store), as opposed to topics (column 1).
// Each column is ONE kind of thing, and both get the same heading weight — the
// old menu stacked these as two small rows under two dividers, which read as
// an afterthought. (A third "Collections" column sat between them until Phase
// I-4 — formats, not places, so it went.)
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
const BROWSE_PREFIXES = ['/category/', '/reviews/category', '/guides/category', '/gear/radar', '/bench', '/shop']

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

// `giftSeason` comes from the server layout (`isGiftSeason()` in
// lib/gift-occasions.ts — the ONE window definition). Computed there, not here:
// this is a client component, and a date read on both sides of hydration can
// disagree across the midnight edge and trip a mismatch.
export default function Header({ giftSeason = false }: { giftSeason?: boolean }) {
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
        {/* Desktop splits by AUDIENCE: the publication and its places sit here
            on the left — Topics first, then Gear · Shop — and Tools (the
            members' home) sits on the right with the account. Home is omitted
            (the logo is the home affordance). */}
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

            {/* Mega-menu panel — two columns, ONE kind of thing per column,
                equal heading weight: Topics · From Boss Daddy. */}
            {catOpen && (
              <div className="absolute right-4 sm:right-6 top-full mt-2 w-[min(680px,calc(100%-3rem))] bg-surface-raised border border-strong rounded-xl p-6 z-50 grid grid-cols-[1.6fr_1fr] gap-6">
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
                  <p className={`${MENU_HEADING} mb-3`}>From Boss Daddy</p>
                  {BOSS_LINKS.map((b) => (
                    <BrowseRow key={b.href} {...b} onNavigate={() => setCatOpen(false)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.map(({ href, label }) => (
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

          {/* Gifts — an INTENT, so it earns a slot, but only in season (1 Oct –
              26 Dec; Phase I-6). The rest of the year it lives inside Gear. */}
          {giftSeason && (
            <Link
              href="/gifts"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(pathname, '/gifts')
                  ? 'bg-accent text-white'
                  : 'text-prose-muted hover:text-prose hover:bg-surface-raised'
              }`}
            >
              {LABELS.gifts.short}
            </Link>
          )}
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

          {/* Shop lives in the left bar as a pillar (Phase I-5); the cart icon
              stays here beside the account and still only appears once it has
              items. */}
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
          {/* The drawer holds ONLY what the bottom tab strip doesn't. Since
              Phase I the strip carries every spine anchor (Home · Explore · Ask ·
              Gear · Tools), so there is no lead row here at all — the drawer is
              the three Browse groups and the account door. Get the App moved to
              InstallPrompt — a one-time nudge beats a permanent row. */}

          {/* Gifts in season is the one pillar the bottom strip doesn't carry
              (it lives under the strip's Gear tab), so it gets the drawer's
              single lead row — same slot Gear used before Phase I. */}
          {giftSeason && (
            <nav aria-label="Seasonal" className="px-4 pt-3">
              <Link
                href="/gifts"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  isActive(pathname, '/gifts')
                    ? 'bg-accent text-white'
                    : 'text-prose hover:bg-surface-raised'
                }`}
              >
                {LABELS.gifts.short}
                <ChevronRightIcon className="w-4 h-4 text-prose-faint" strokeWidth={2} />
              </Link>
            </nav>
          )}

          {/* Browse — the same two groups as the desktop mega-menu, same
              heading style. Topics stays collapsible (10 rows); the other is
              short enough to show open. */}
          <div className={`px-4 pb-2 ${giftSeason ? 'pt-5 border-t border-soft mt-3' : 'pt-3'}`}>
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
