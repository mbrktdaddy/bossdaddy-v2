'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  username: string
  isAdmin: boolean
}

function NavLinks({ isAdmin, onNav }: { isAdmin: boolean; onNav?: () => void }) {
  const pathname = usePathname()

  const link = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      key={href}
      href={href}
      onClick={onNav}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
        pathname === href || pathname.startsWith(href + '/')
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </Link>
  )

  return (
    <>
      <p className="text-xs text-gray-600 font-medium uppercase tracking-widest px-3 mb-2">Reviews</p>
      {link('/dashboard/reviews', 'My Reviews',
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      )}
      {link('/dashboard/reviews/new', 'New Review',
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
      )}

      <p className="text-xs text-gray-600 font-medium uppercase tracking-widest px-3 mb-2 mt-4">Articles</p>
      {link('/dashboard/articles', 'My Articles',
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
      )}
      {link('/dashboard/articles/new', 'New Article',
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
      )}

      {isAdmin && (
        <>
          <p className="text-xs text-gray-600 font-medium uppercase tracking-widest px-3 mb-2 mt-4">Admin</p>
          {link('/dashboard/moderation', 'Moderation Queue',
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          )}
          {link('/dashboard/users', 'Users',
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          )}
        </>
      )}
    </>
  )
}

export default function DashboardNav({ username, isAdmin }: Props) {
  const [open, setOpen] = useState(false)

  const sidebarContent = (onNav?: () => void) => (
    <>
      {/* Brand + user */}
      <div className="px-5 py-5 border-b border-gray-800/60">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-black text-base tracking-tight">
            <span className="text-orange-500">BOSS</span>
            <span className="text-white"> DADDY</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {username[0]?.toUpperCase() ?? 'B'}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-300 truncate font-medium">@{username}</p>
            <p className="text-xs text-gray-600">{isAdmin ? 'Admin' : 'Author'}</p>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavLinks isAdmin={isAdmin} onNav={onNav} />
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-800/60 space-y-0.5">
        <Link
          href="/"
          target="_blank"
          onClick={onNav}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View Site
        </Link>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
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
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 bg-gray-900 border-r border-gray-800/60 flex-col shrink-0">
        {sidebarContent()}
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-gray-900 border-b border-gray-800/60 flex items-center justify-between px-4">
        <Link href="/" className="font-black text-base tracking-tight">
          <span className="text-orange-500">BOSS</span>
          <span className="text-white"> DADDY</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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

      {/* ── Mobile overlay ──────────────────────────────────────────────── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/60"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Mobile drawer ───────────────────────────────────────────────── */}
      <aside className={`md:hidden fixed inset-y-0 left-0 z-40 w-72 bg-gray-900 border-r border-gray-800/60 flex flex-col transform transition-transform duration-200 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {sidebarContent(() => setOpen(false))}
      </aside>
    </>
  )
}
