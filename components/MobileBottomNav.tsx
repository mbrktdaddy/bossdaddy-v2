'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isImmersiveRoute } from '@/lib/immersive-routes'
import { LABELS } from '@/lib/labels'

const ICON_CLS = 'w-5 h-5'

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

function StarIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  )
}

function BookIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  )
}

function BagIcon({ active }: { active: boolean }) {
  return active ? (
    <svg className={ICON_CLS} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 0 0 4.25 22.5h15.5a1.875 1.875 0 0 0 1.865-2.071l-1.263-12a1.875 1.875 0 0 0-1.865-1.679H16.5V6a4.5 4.5 0 1 0-9 0Zm6.75 0a2.25 2.25 0 0 0-4.5 0v.75h4.5V6Zm-1.75 6.75a.75.75 0 0 0-1.5 0v.75a.75.75 0 0 0 1.5 0v-.75Z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className={ICON_CLS} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  )
}

// READ / READ / ASK / DO / SHOP: Reviews and Guides on the left, "Ask the Boss" in the
// elevated center slot, Tools and Gear on the right. Search isn't here (header ⌘K pill +
// the mobile search bar own it).
//
// ── WHY HOME IS NOT A TAB (operator decision, 2026-08-17) ────────────────────────────
// Tools had NO mobile entry at all — it sits in the desktop header nav, and before
// nav-ia-plan Phase C those pages ran their own chrome with no bottom strip whatsoever.
// So the most engaging surface on the site was the hardest to reach on the device it was
// built for, while four of five slots pointed at reading.
//
// Five slots, not six: six is crowded at 393px, and the elevated FAB has to sit dead
// centre, which an even count can't give it. So a tab had to yield, and Home is the one
// that costs nothing — the wordmark in the header goes home from every page on the site.
// Gear and Ask were explicitly protected.
//
// `match` overrides the default prefix test where a tab owns more than its own subtree:
// Tools covers the whole spine (/tools, /goals, /today) but NOT /tools/the-boss, which
// belongs to the Ask slot — otherwise two things light up for one page.
const TABS = [
  { href: '/reviews', label: LABELS.reviews.plural, exact: false, Icon: StarIcon },
  { href: '/guides',  label: LABELS.guides.plural,  exact: false, Icon: BookIcon },
  {
    href: '/tools',
    label: LABELS.tools.short,
    exact: false,
    Icon: ToolboxIcon,
    match: (p: string) =>
      !p.startsWith('/tools/the-boss')
      && (p === '/tools' || p.startsWith('/tools/') || p === '/goals' || p.startsWith('/goals/') || p === '/today'),
  },
  { href: '/gear',    label: LABELS.gear.short,     exact: false, Icon: BagIcon },
]

export default function MobileBottomNav() {
  const pathname = usePathname()

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
        className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
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
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-chrome/95 backdrop-blur-sm border-t border-soft"
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Ask</span>
        </Link>

        {TABS.slice(2).map(renderTab)}
      </div>
    </nav>
  )
}
