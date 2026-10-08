'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isImmersiveRoute } from '@/lib/immersive-routes'
import { LABELS } from '@/lib/labels'
import { useBottomNavHidden } from '@/components/useBottomNavHidden'

const ICON_CLS = 'w-5 h-5'

// The strip's full height (h-14 row + 1px top border + the safe-area pad below it).
// Anything else pinned to the mobile bottom edge — the review buy bar, the install
// prompt — sits at `bottom: MOBILE_BOTTOM_NAV_OFFSET` so it stacks ABOVE the strip
// instead of covering it. Change the row height here and they follow.
export const MOBILE_BOTTOM_NAV_OFFSET = 'calc(3.5rem + 1px + env(safe-area-inset-bottom))'

// A TOOLBOX, DRAWN FROM PRIMITIVES — a rounded rect, a handle, a clasp line — rather
// than a traced wrench. Same call the launcher tiles made: at 20px a multi-path wrench
// turns to mush, and a borrowed bézier I can't verify by reading is a glyph I can't
// trust. Solid and outline share one silhouette, like every other icon in this strip.
function ToolboxIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 8.25V6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75v1.5h-1.5v-1.5a.75.75 0 0 0-.75-.75h-1.5a.75.75 0 0 0-.75.75v1.5H9Z" />
      <rect x="3" y="8.25" width="18" height="12" rx="1.5" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <rect x="3" y="8.25" width="18" height="12" rx="1.5" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 8.25V6.75A2.25 2.25 0 0 1 11.25 4.5h1.5A2.25 2.25 0 0 1 15 6.75v1.5M3 13.5h6v1.5a.75.75 0 0 0 .75.75h4.5a.75.75 0 0 0 .75-.75v-1.5h6"
      />
    </svg>
  )
}

// A HOUSE FROM PRIMITIVES — apex, two eaves, a body, a door — one closed path that
// reads correctly filled OR stroked, which is the whole reason it's drawn this way:
// solid and outline are the same `d`, so the silhouette cannot drift between states.
const HOUSE_PATH = 'M12 3 L21.5 11 L19.5 11 L19.5 20.5 L14 20.5 L14 15 L10 15 L10 20.5 L4.5 20.5 L4.5 11 L2.5 11 Z'

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={HOUSE_PATH} />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={HOUSE_PATH} />
    </svg>
  )
}

// A COMPASS FROM PRIMITIVES — a ring and a needle (one four-point diamond at 45°).
// Solid fills the ring and cuts the needle out of it (evenodd); outline strokes both.
// Same silhouette in both states, like every other icon here.
const NEEDLE_PATH = 'M15.5 8.5 L13.4 13.4 L8.5 15.5 L10.6 10.6 Z'

function CompassIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d={`M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z ${NEEDLE_PATH}`} clipRule="evenodd" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinejoin="round" d={NEEDLE_PATH} />
    </svg>
  )
}

// A PRICE TAG FROM PRIMITIVES — a pentagon with one corner cut square and a hole
// for the string. Gear is the buying side of the strip; the tag says "a thing
// with a price" without borrowing a bag or a cart (the cart is the Shop's icon).
const TAG_PATH = 'M4 4 L11.5 4 L20.5 13 L13 20.5 L4 11.5 Z'
const TAG_HOLE = 'M8.5 7 A1.5 1.5 0 1 0 8.5 10 A1.5 1.5 0 1 0 8.5 7 Z'

function TagIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d={`${TAG_PATH} ${TAG_HOLE}`} clipRule="evenodd" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinejoin="round" d={TAG_PATH} />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  )
}

// HOME / READ / ASK / BUY / DO: Home and Explore on the left, "Ask the Boss" in the
// elevated center slot, Gear and Tools on the right. Search isn't here (header ⌘K pill +
// the mobile search bar own it).
//
// ── EXPLORE = EVERYTHING YOU READ, GEAR = EVERYTHING YOU BUY (Phase I, 2026-10-08) ───
// This strip used to carry Reviews and Guides as two tabs, with Gear deliberately left
// out (operator decision, 2026-08-17: tabs are earned by revisit frequency, and gear is
// reached THROUGH content). Phase I of docs/nav-ia-plan.md revised that knowingly:
// a content FORMAT never gets a nav slot (invariant 10) — reviews, guides, comparisons
// and best-of lists are article shapes inside Topics, so they collapse into ONE Explore
// tab that lands on the /explore index. The freed slot goes to Gear, which makes the
// strip's split match the desktop bar's: the publication on the left, the places on the
// right. Home stays leftmost (a wordmark is not a thumb target); Ask and Tools stay
// protected (Ask is the differentiator, Tools is the daily-return surface).
//
// Five slots, not six: six is crowded at 393px, and the elevated FAB has to sit dead
// centre, which an even count can't give it. Adding a tab means naming the one it
// replaces (invariant 9).
//
// Home is `exact` on purpose: a prefix test on '/' lights up on every page of the site.
//
// `match` overrides the default prefix test where a tab owns more than its own subtree:
// Explore lights on every READING surface (the index, the four format listings, the
// category hubs) but NOT /search — search is the header's, and lighting a tab for it
// would claim the result page lives inside Explore. Gear lights on the buying surfaces
// (/gear, the Bench, stacks, gifts); /shop is the store and stays its own thing. Tools
// covers the whole spine (/tools, /goals, /today) but NOT /tools/the-boss, which belongs
// to the Ask slot — otherwise two things light up for one page.
const under = (p: string, ...roots: string[]) => roots.some((r) => p === r || p.startsWith(r + '/'))

const TABS = [
  { href: '/',        label: 'Home',                exact: true,  Icon: HomeIcon },
  {
    href: '/explore',
    label: LABELS.explore.short,
    exact: false,
    Icon: CompassIcon,
    match: (p: string) => under(p, '/explore', '/reviews', '/guides', '/comparisons', '/picks', '/category'),
  },
  {
    href: '/gear',
    label: LABELS.gear.short,
    exact: false,
    Icon: TagIcon,
    match: (p: string) => under(p, '/gear', '/bench', '/stacks', '/gifts'),
  },
  {
    href: '/tools',
    label: LABELS.tools.short,
    exact: false,
    Icon: ToolboxIcon,
    match: (p: string) =>
      !p.startsWith('/tools/the-boss')
      && (p === '/tools' || p.startsWith('/tools/') || p === '/goals' || p.startsWith('/goals/') || p === '/today'),
  },
]

export default function MobileBottomNav() {
  const pathname = usePathname()
  const scrolledAway = useBottomNavHidden()

  // Immersive surfaces (e.g. the DM conversation view) hide the strip so the
  // composer sits flush at the bottom. PublicMain drops its clearance in step.
  if (isImmersiveRoute(pathname)) return null

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname === href || pathname.startsWith(href + '/')
  }

  const renderTab = ({ href, label, exact, Icon, match }: (typeof TABS)[number] & { match?: (p: string) => boolean }) => {
    const active = match ? match(pathname) : isActive(href, exact)
    return (
      <Link
        key={href}
        href={href}
        className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
          active ? 'text-copper' : 'text-prose-faint hover:text-prose-muted'
        }`}
        aria-current={active ? 'page' : undefined}
      >
        <Icon active={active} />
        {label}
      </Link>
    )
  }

  // Ask the Boss — elevated center slot (the AI concierge entry on mobile).
  const askActive = pathname.startsWith('/tools/the-boss')

  return (
    <nav
      aria-label="Primary mobile navigation"
      // Slides away while reading (useBottomNavHidden). The extra 1.5rem carries the
      // Ask button, which bulges above the strip, fully off-screen with it.
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden bg-chrome/95 backdrop-blur-sm border-t border-soft transition-transform duration-300 ${
        scrolledAway ? 'translate-y-[calc(100%+1.5rem)]' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-14">
        {TABS.slice(0, 2).map(renderTab)}

        <Link
          href="/tools/the-boss"
          aria-label="Ask the Boss"
          aria-current={askActive ? 'page' : undefined}
          className="relative flex flex-col items-center justify-end pb-1.5"
        >
          <span className="absolute -top-4 w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center shadow-lg shadow-accent/30 ring-4 ring-background">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="text-[11px] font-semibold text-accent">Ask</span>
        </Link>

        {TABS.slice(2).map(renderTab)}
      </div>
    </nav>
  )
}
