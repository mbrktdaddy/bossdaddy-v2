// Tools route group — minimal chrome, no editorial nav. Same brand anchor
// (wordmark, orange `#CC5500`, voice) and the same Footer as the rest of
// the site. See docs/dad-tools-plan.md §5 for the architecture rationale.

import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/Footer'
import AccountMenu from '@/components/AccountMenu'

// No longer async: the only await was a profiles role lookup, done solely to
// choose between the words "Account" and "Dashboard" on a link the account menu
// now renders itself. Removing it takes a per-render database round trip off
// every page in /goals, /today and /tools.
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div data-theme="dark" className="min-h-screen bg-background text-prose flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>

      <header className="border-b border-faint bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 min-w-0">
              <Image
                src="/images/bd-logo-icon.png"
                alt="Boss Daddy"
                width={36}
                height={36}
                priority
                className="h-8 w-8 object-contain shrink-0"
              />
              <span className="font-black text-lg sm:text-xl tracking-tight shrink-0">
                <span className="text-accent">BOSS</span>
                <span className="text-prose"> DADDY</span>
              </span>
            </Link>
          </div>
          {/* No "Tools · Beta" pill. It crowded the row on a phone — wordmark,
              pill, bell and avatar in 393px — and it was doing a job the pages
              already do for themselves: /tools, /goals and /today each open with
              their own H1. A chrome-level label that repeats the page title only
              earns its width when the page doesn't say where you are. */}
          {/* THE SAME MENU THE REST OF THE SITE HAS. This chrome is deliberately
              minimal (docs/dad-tools-plan.md §5) and had grown its own bespoke
              nav instead: a "← Boss Daddy" link, and an Account/Dashboard text
              link whose label needed a role lookup on every render.

              All three were redundant once the real menu is here — the wordmark
              already goes home, and the dropdown already carries Dashboard,
              Account Settings and Sign In. Deleting them also deletes a database
              query per page load.

              alwaysShow because there's no hamburger drawer in this chrome to
              repeat the links at narrow widths. */}
          <nav className="flex items-center gap-3 shrink-0">
            <AccountMenu alwaysShow />
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1 w-full">
        {children}
      </main>

      <Footer />
    </div>
  )
}
