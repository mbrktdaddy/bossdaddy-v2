'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import GlobalSearch from './GlobalSearch'
import { LABELS } from '@/lib/labels'

interface Props {
  username: string
  isAdmin: boolean
  role: string
}

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  adminOnly?: boolean
}

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Dashboard',
    items: [
      { href: '/dashboard', label: 'Home',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
      },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/dashboard/guides', label: LABELS.guides.plural,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
      },
      { href: '/dashboard/guides/new', label: `New ${LABELS.guides.singular}`,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
      },
      { href: '/dashboard/reviews', label: LABELS.reviews.plural,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      },
      { href: '/dashboard/reviews/new', label: `New ${LABELS.reviews.singular}`,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
      },
      { href: '/dashboard/comments', label: 'Comments', adminOnly: true,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
      },
    ],
  },
  {
    label: 'Distribute',
    items: [
      { href: '/dashboard/social', label: 'Social Posts', adminOnly: true,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
      },
      { href: '/dashboard/admin/newsletter', label: 'Newsletter', adminOnly: true,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      },
      { href: '/dashboard/admin/press-outreach', label: 'Press Outreach', adminOnly: true,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 12v4m0 0l-2-2m2 2l2-2" /></svg>
      },
    ],
  },
  {
    label: 'Media',
    items: [
      { href: '/dashboard/media', label: 'Media Library',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg>
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/dashboard/users', label: 'Users',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      },
      { href: '/dashboard/admin/products', label: 'Products',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
      },
      { href: '/dashboard/admin/picks', label: 'The Vault',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      },
      { href: '/dashboard/admin/spotlights', label: 'Spotlights',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
      },
      { href: '/dashboard/admin/wishlist', label: LABELS.bench.short,
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
      },
      { href: '/dashboard/admin/merch', label: 'Merch',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      },
      { href: '/dashboard/admin/orders', label: 'Orders',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
      },
      { href: '/dashboard/admin/engagement', label: 'Engagement',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      { href: '/dashboard/profile/voice', label: 'Voice Profile',
        icon: <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
      },
    ],
  },
]

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', author: 'Author', member: 'Member' }

export default function DashboardNav({ username, isAdmin, role }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  function NavLinks({ onNav }: { onNav?: () => void }) {
    return (
      <>
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(item =>
            !item.adminOnly || isAdmin
          )
          // Hide the entire Admin section (and its heading) for non-admins
          if (section.label === 'Admin' && !isAdmin) return null
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label} className="mb-4">
              <p className="text-xs text-prose-faint font-medium uppercase tracking-widest px-3 mb-2">{section.label}</p>
              {visibleItems.map((item) => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNav}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      active ? 'bg-surface-raised text-prose' : 'text-prose-muted hover:bg-surface-raised hover:text-prose'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                )
              })}
            </div>
          )
        })}
      </>
    )
  }

  const sidebarContent = (onNav?: () => void) => (
    <>
      {/* Brand + user */}
      <div className="px-5 py-5 border-b border-soft space-y-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-black text-base tracking-tight">
            <span className="text-accent-text">BOSS</span>
            <span className="text-prose"> DADDY</span>
          </span>
        </Link>
        <Link href="/dashboard/profile" onClick={onNav} className="flex items-center gap-2 group">
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white shrink-0">
            {username[0]?.toUpperCase() ?? 'B'}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-prose group-hover:text-prose truncate font-medium transition-colors">@{username}</p>
            <p className="text-xs text-prose-faint">{ROLE_LABEL[role] ?? 'Member'}</p>
          </div>
        </Link>
        {isAdmin && <GlobalSearch />}
      </div>

      {/* Nav */}
      <nav aria-label="Dashboard navigation" className="flex-1 px-3 py-4 overflow-y-auto">
        <NavLinks onNav={onNav} />
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-soft space-y-0.5">
        <Link
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNav}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Site
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </form>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-surface border-r border-soft flex-col shrink-0">
        {sidebarContent()}
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-surface border-b border-soft flex items-center justify-between px-4">
        <Link href="/" className="font-black text-base tracking-tight">
          <span className="text-accent-text">BOSS</span>
          <span className="text-prose"> DADDY</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-3 rounded-lg text-prose-muted hover:text-prose hover:bg-surface-raised transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
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

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-zinc-900/60" onClick={() => setOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-40 w-72 bg-surface border-r border-soft flex flex-col transform transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent(() => setOpen(false))}
      </aside>
    </>
  )
}
