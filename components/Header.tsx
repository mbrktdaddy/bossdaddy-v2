'use client'

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CATEGORIES } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import { BRAND } from '@/lib/brand'
import CartIcon from '@/components/CartIcon'
import CategoryIcon from '@/components/CategoryIcon'
import AccountMenu, { useAuthUser } from '@/components/AccountMenu'
import ConnectionBadge from '@/components/account/ConnectionBadge'
import { isImmersiveRoute } from '@/lib/immersive-routes'
import { buttonVariants } from '@/components/ui/Button'
import { fieldClass } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { Avatar } from '@/components/ui/Avatar'
import { Menu, MenuItem, MenuLabel, MenuDivider, MenuFooterLink, menuItemClass } from '@/components/ui/Menu'
import { BagIcon, ChevronDownIcon, SearchIcon, XIcon } from '@/components/icons'

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

// One heading style for every Browse group, desktop and mobile alike — the
// Eyebrow recipe (MenuLabel). It was `text-copper`, an orange alias, retired 2026-10-14.
const MENU_HEADING = 'text-xs text-eyebrow uppercase tracking-widest font-semibold'

// The masthead nav item (Hard Goods, the approved mockup's `.nav a`): Montserrat
// bold 14px, muted at rest, white on hover. ACTIVE = ORANGE TEXT, never a fill —
// the old `bg-accent text-white` put 14px white text on orange (3.6:1 on the
// zone orange, fails AA) and was the last pill in the chrome. Matches the
// bottom strip's active tab. Colour is the only state; geometry never moves.
const NAV_ITEM = 'inline-flex items-center gap-1.5 h-11 px-3 rounded-md font-display font-bold text-sm transition-colors'
const navTone = (active: boolean) => (active ? 'text-accent' : 'text-prose-muted hover:text-prose')

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

/** The two-line label for a "From Boss Daddy" row — the place + what it is. */
function BrowseLabel({ label, blurb }: { label: string; blurb: string }) {
  return (
    <span className="min-w-0 py-2">
      <span className="block text-sm font-bold text-prose leading-tight">{label}</span>
      <span className="block text-xs text-prose-muted mt-0.5 line-clamp-1">{blurb}</span>
    </span>
  )
}

/** Fixed-width icon slot, so the bench's live dot lines up with the svg glyphs. */
function BrowseIcon({ icon }: { icon: ReactNode }) {
  return <span className="shrink-0 inline-flex w-4 justify-center text-accent-text">{icon}</span>
}

// The account destinations in AccountMenu's order (Account first — that row
// carries the avatar in the drawer). The drawer mirrors the desktop menu so the
// account is one place on both; the pending-requests badge rides on Contacts.
function accountLinks(hasDashboard: boolean): { href: string; label: string; badge?: boolean }[] {
  return [
    { href: '/account/settings', label: LABELS.settings.short },
    { href: '/account/connections', label: LABELS.contacts.short, badge: true },
    { href: '/account/messages', label: LABELS.messages.short },
    ...(hasDashboard ? [{ href: '/dashboard', label: 'Dashboard' }] : []),
    { href: '/install', label: LABELS.app.short },
  ]
}

// `giftSeason` comes from the server layout (`isGiftSeason()` in
// lib/gift-occasions.ts — the ONE window definition). Computed there, not here:
// this is a client component, and a date read on both sides of hydration can
// disagree across the midnight edge and trip a mismatch.
export default function Header({ giftSeason = false }: { giftSeason?: boolean }) {
  const { username, role, avatarUrl } = useAuthUser()
  const hasDashboard = role === 'author' || role === 'admin'

  const [mobileOpen, setMobileOpen]   = useState(false)
  const [searchOpen, setSearchOpen]   = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const [mobileCatOpen, setMobileCat] = useState(false)
  const pathname    = usePathname()
  const searchRef   = useRef<HTMLInputElement>(null)

  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setTimeout(() => searchRef.current?.focus(), 50)
  }, [])

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
  useEffect(() => { setMobileOpen(false); setSearchOpen(false); setMobileSearchOpen(false) }, [pathname])

  const isBrowseActive = BROWSE_PREFIXES.some((p) => pathname.startsWith(p))

  return (
    <header
      data-theme="dark" /* chrome ZONE — stays near-black on the light canvas (lib/canvas.ts) */
      /* Hard Goods (2026-10-14): SOLID chrome at every scroll position with the
         4px orange rule under it — the DeWalt / STIHL stripe, the brand's edge on
         the white page. The old "flush at the top, blur + hairline once scrolled"
         state and its scroll listener went with the dark brand band it was
         matching (brand-guide §5/§10). Solid, never transparent: the header is
         sticky in normal flow, so a transparent one would show the page canvas. */
      className="sticky top-0 z-50 bg-chrome border-b-4 border-accent"
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
          <span className="flex flex-col leading-none">
            <span className="text-prose">BOSS DADDY</span>
            {/* The folded masthead (A2, 2026-10-14; brand-guide §5): on a phone the
                tagline is a small orange signature under the wordmark — one band,
                not two. On lg+ it moves into the orange brand band under the
                masthead (HomeHero) and this line hides. */}
            <span className="lg:hidden mt-1 text-[9px] font-extrabold uppercase tracking-[0.22em] text-accent">
              {BRAND.tagline}
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        {/* Desktop splits by AUDIENCE: the publication and its places sit here
            on the left — Topics first, then Gear · Shop — and Tools (the
            members' home) sits on the right with the account. Home is omitted
            (the logo is the home affordance). */}
        <nav aria-label="Site navigation" className="hidden md:flex items-center gap-1">
          {/* Topics mega-menu — first, because readers navigate by subject.
              `placement="masthead"`: the panel anchors to the header container
              (the `relative h-16` div), not the trigger, so it opens on the same
              line as the Account and Activity menus — 8px under the orange rule,
              flush with the right gutter — and its full width never runs off
              screen at md. Two columns, ONE kind of thing per column, equal
              heading weight: Topics · From Boss Daddy. */}
          <Menu
            placement="masthead"
            width="mega"
            label={LABELS.topics.short}
            trigger={({ open, ...props }) => (
              <button type="button" {...props} className={`${NAV_ITEM} ${open ? 'text-prose' : navTone(isBrowseActive)}`}>
                {LABELS.topics.short}
                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} strokeWidth={2} />
              </button>
            )}
          >
            <div className="grid grid-cols-[1.6fr_1fr] gap-4 p-3">
              <div>
                <MenuLabel>{LABELS.topics.short}</MenuLabel>
                <div className="grid grid-cols-2 gap-x-1">
                  {CATEGORIES.map((cat) => (
                    <MenuItem
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      current={pathname === `/category/${cat.slug}`}
                      iconTone="accent"
                      icon={<CategoryIcon slug={cat.slug} />}
                    >
                      <span className="truncate">{cat.label}</span>
                    </MenuItem>
                  ))}
                </div>
              </div>

              <div className="border-l border-soft pl-4">
                <MenuLabel>From Boss Daddy</MenuLabel>
                {BOSS_LINKS.map((b) => (
                  <MenuItem key={b.href} href={b.href} current={isActive(pathname, b.href)} iconTone="accent" icon={<BrowseIcon icon={b.icon} />}>
                    <BrowseLabel label={b.label} blurb={b.blurb} />
                  </MenuItem>
                ))}
              </div>
            </div>
            <MenuDivider />
            <MenuFooterLink href="/explore">{LABELS.topics.all} →</MenuFooterLink>
          </Menu>

          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} aria-current={isActive(pathname, href) ? 'page' : undefined} className={`${NAV_ITEM} ${navTone(isActive(pathname, href))}`}>
              {label}
            </Link>
          ))}

          {/* Gifts — an INTENT, so it earns a slot, but only in season (1 Oct –
              26 Dec; Phase I-6). The rest of the year it lives inside Gear. */}
          {giftSeason && (
            <Link href="/gifts" aria-current={isActive(pathname, '/gifts') ? 'page' : undefined} className={`${NAV_ITEM} ${navTone(isActive(pathname, '/gifts'))}`}>
              {LABELS.gifts.short}
            </Link>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1">
          {/* Search — the mockup's masthead field: on lg+ a field-shaped box with
              the placeholder + ⌘K; at md an icon button. Either expands to a
              real input on click (or ⌘K). */}
          <div className="hidden md:flex items-center">
            {searchOpen ? (
              <form
                action="/search"
                role="search"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setSearchOpen(false)
                }}
              >
                <div className="relative">
                  <label htmlFor="header-search" className="sr-only">{LABELS.search.label}</label>
                  <input
                    id="header-search"
                    ref={searchRef}
                    name="q"
                    type="search"
                    autoComplete="off"
                    placeholder={LABELS.search.placeholder}
                    onKeyDown={(e) => { if (e.key === 'Escape') setSearchOpen(false) }}
                    className={fieldClass({ className: 'w-56 lg:w-64 pl-9' })}
                  />
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-prose-faint pointer-events-none" strokeWidth={2} />
                </div>
              </form>
            ) : (
              <>
                <IconButton label={LABELS.search.label} onClick={openSearch} aria-keyshortcuts="Meta+K Control+K" className="lg:hidden">
                  <SearchIcon className="w-5 h-5" strokeWidth={2} />
                </IconButton>
                <button
                  type="button"
                  onClick={openSearch}
                  aria-label={LABELS.search.label}
                  aria-keyshortcuts="Meta+K Control+K"
                  className="hidden lg:inline-flex items-center gap-2 h-11 min-w-[220px] px-3 rounded-md border border-strong text-prose-muted hover:text-prose hover:border-prose transition-colors"
                >
                  <SearchIcon className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span className="flex-1 text-left text-[13px]">{LABELS.search.placeholder}</span>
                  <kbd className="text-[10px] font-mono border border-strong rounded-sm px-1.5 py-0.5 leading-none text-prose-faint">⌘K</kbd>
                </button>
              </>
            )}
          </div>

          {/* Tools — the members' home (Today, goals, savings) plus the public
              calculators. Right side, with the account, because it's "yours"
              rather than the publication. Same glyph as the mobile Tools tab. */}
          <Link
            href={TOOLS_HREF}
            aria-current={isToolsActive(pathname) ? 'page' : undefined}
            className={`hidden md:inline-flex ${NAV_ITEM} ${navTone(isToolsActive(pathname))}`}
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
            <IconButton
              label={mobileSearchOpen ? 'Close search' : LABELS.search.label}
              aria-expanded={mobileSearchOpen}
              aria-controls={mobileSearchOpen ? 'mobile-search' : undefined}
              onClick={() => {
                const next = !mobileSearchOpen
                setMobileSearchOpen(next)
                setMobileOpen(false)
                if (next) setTimeout(() => mobileSearchRef.current?.focus(), 50)
              }}
              className="md:hidden"
            >
              {mobileSearchOpen ? <XIcon className="w-5 h-5" strokeWidth={2} /> : <SearchIcon className="w-5 h-5" strokeWidth={2} />}
            </IconButton>
          )}

          {/* Hamburger */}
          <IconButton
            label={mobileOpen ? 'Close menu' : 'Menu'}
            aria-expanded={mobileOpen}
            aria-controls={mobileOpen ? 'mobile-drawer' : undefined}
            onClick={() => { setMobileOpen(!mobileOpen); setMobileSearchOpen(false) }}
            className="md:hidden"
          >
            {mobileOpen ? (
              <XIcon className="w-5 h-5" strokeWidth={2} />
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </IconButton>
        </div>
      </div>

      {/* Mobile search row — opened by the header's search icon, closed by
          default. NEVER on immersive routes (the DM thread): an app-like surface
          carries minimal chrome, and that fixed-height surface's CSS fallback
          assumes a 4rem header — this row would push its composer off-screen. */}
      {mobileSearchOpen && !isImmersiveRoute(pathname) && (
      <div id="mobile-search" className="md:hidden px-4 pt-1 pb-3">
        <form action="/search" role="search">
          <div className="relative">
            <label htmlFor="mobile-search-input" className="sr-only">{LABELS.search.label}</label>
            <input
              id="mobile-search-input"
              ref={mobileSearchRef}
              name="q"
              type="search"
              autoComplete="off"
              placeholder={LABELS.search.placeholder}
              className={fieldClass({ className: 'pl-9' })}
            />
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-prose-faint pointer-events-none" strokeWidth={2} />
          </div>
        </form>
      </div>
      )}

      {/* Mobile drawer — part of the chrome zone, so it's black like the masthead.
          max-h subtracts the sticky header (4rem + its 4px orange rule) AND the
          safe-area inset (home indicator on iPhone, address bar on some
          browsers) so the last rows aren't hidden behind browser chrome; the
          trailing padding covers devices where the safe area is a real cutout.
          Every row is the menus' row (`menuItemClass`, 44px) — the drawer is the
          phone's version of the Topics + Account menus, so it reads the same. */}
      {mobileOpen && (
        <div
          id="mobile-drawer"
          className="md:hidden border-t border-soft bg-chrome overflow-y-auto"
          style={{
            maxHeight: 'calc(100dvh - 4.25rem - env(safe-area-inset-bottom))',
            paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* The drawer holds ONLY what the bottom tab strip doesn't. Since
              Phase I the strip carries every spine anchor (Home · Explore · Ask ·
              Gear · Tools), so there is no lead row here at all — the drawer is
              the Browse groups and the account. */}

          {/* Gifts in season is the one pillar the bottom strip doesn't carry
              (it lives under the strip's Gear tab), so it gets the drawer's
              single lead row — same slot Gear used before Phase I. */}
          {giftSeason && (
            <nav aria-label="Seasonal" className="px-3 pt-3">
              <Link
                href="/gifts"
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(pathname, '/gifts') ? 'page' : undefined}
                className={menuItemClass({ current: isActive(pathname, '/gifts'), className: 'font-display font-bold' })}
              >
                {LABELS.gifts.short}
              </Link>
            </nav>
          )}

          {/* Browse — the same two groups as the desktop mega-menu, same
              heading style. Topics stays collapsible (10 rows); the other is
              short enough to show open. */}
          <div className={`px-3 pb-2 ${giftSeason ? 'pt-3 border-t border-soft mt-3' : 'pt-2'}`}>
            <button
              type="button"
              onClick={() => setMobileCat(!mobileCatOpen)}
              aria-expanded={mobileCatOpen}
              aria-controls={mobileCatOpen ? 'mobile-topics' : undefined}
              className={`flex items-center justify-between w-full min-h-11 px-3 ${MENU_HEADING}`}
            >
              {LABELS.topics.short}
              <ChevronDownIcon className={`w-4 h-4 transition-transform ${mobileCatOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
            </button>
            {mobileCatOpen && (
              <div id="mobile-topics" className="grid grid-cols-2 gap-x-1 pb-2">
                {CATEGORIES.map((cat) => {
                  const current = pathname === `/category/${cat.slug}`
                  return (
                    <Link
                      key={cat.slug}
                      href={`/category/${cat.slug}`}
                      onClick={() => setMobileOpen(false)}
                      aria-current={current ? 'page' : undefined}
                      className={menuItemClass({ current, iconTone: 'accent' })}
                    >
                      <CategoryIcon slug={cat.slug} />
                      <span className="truncate">{cat.label}</span>
                    </Link>
                  )
                })}
                <Link
                  href="/explore"
                  onClick={() => setMobileOpen(false)}
                  className={menuItemClass({ className: 'col-span-2 font-display font-extrabold text-[11px] uppercase tracking-[0.1em]' })}
                >
                  {LABELS.topics.all} →
                </Link>
              </div>
            )}
          </div>

          <div className="px-3 pb-3 border-t border-soft pt-3">
            <p className={`${MENU_HEADING} px-3 pb-1`}>From Boss Daddy</p>
            {BOSS_LINKS.map((b) => (
              <Link
                key={b.href}
                href={b.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(pathname, b.href) ? 'page' : undefined}
                className={menuItemClass({ current: isActive(pathname, b.href), iconTone: 'accent' })}
              >
                <BrowseIcon icon={b.icon} />
                <BrowseLabel label={b.label} blurb={b.blurb} />
              </Link>
            ))}
          </div>

          {/* Account — the same destinations, in the same order, as the
              desktop AccountMenu, so the account is one place on both. The
              pending-requests badge rides on Contacts, where the requests are. */}
          <div className="px-3 border-t border-soft pt-3">
            {username ? (
              <nav aria-label={LABELS.account.short}>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  aria-current={pathname === '/account' ? 'page' : undefined}
                  className={menuItemClass({ current: pathname === '/account' })}
                >
                  <Avatar src={avatarUrl} name={username} size={32} />
                  <span className="min-w-0 py-1.5">
                    <span className="block text-sm font-bold text-prose truncate">@{username}</span>
                    <span className="block text-xs text-prose-muted">{LABELS.account.short}</span>
                  </span>
                </Link>
                {accountLinks(hasDashboard).map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={pathname.startsWith(r.href) ? 'page' : undefined}
                    className={menuItemClass({ current: pathname.startsWith(r.href) })}
                  >
                    <span className="flex-1">{r.label}</span>
                    {r.badge && <ConnectionBadge />}
                  </Link>
                ))}
                <MenuDivider />
                <form action="/api/auth/signout" method="POST">
                  <button type="submit" className={menuItemClass()}>
                    Sign out
                  </button>
                </form>
              </nav>
            ) : (
              <div className="grid grid-cols-2 gap-2 px-1 pt-1">
                <Link href={`/register?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                  className={buttonVariants()}>
                  Join free
                </Link>
                <Link href={`/login?next=${encodeURIComponent(pathname)}`} onClick={() => setMobileOpen(false)}
                  className={buttonVariants({ variant: 'outline' })}>
                  Sign in
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
