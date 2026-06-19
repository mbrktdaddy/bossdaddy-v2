'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isImmersiveRoute } from '@/lib/immersive-routes'

/**
 * Ask the Boss — desktop concierge entry (the AI assistant layer).
 *
 * The mobile counterpart is the elevated center slot in MobileBottomNav; this
 * FAB is the desktop equivalent (md+ only). Starts as a simple link to
 * /tools/the-boss; the plan is to grow it into a slide-in chat drawer as the
 * assistant's functionality expands. Hidden on the Boss page itself and on
 * immersive routes (e.g. the DM conversation view).
 */
export default function AskBossFab() {
  const pathname = usePathname()
  if (isImmersiveRoute(pathname)) return null
  if (pathname.startsWith('/tools/the-boss')) return null

  return (
    <div className="hidden md:flex fixed bottom-6 right-6 z-40 items-center gap-2.5">
      <span className="bg-surface border border-soft rounded-full px-3.5 py-2 text-xs font-bold text-prose shadow-xl shadow-black/40">
        Ask the Boss
      </span>
      <Link
        href="/tools/the-boss"
        aria-label="Ask the Boss — the AI concierge"
        className="w-14 h-14 rounded-full bg-accent hover:bg-accent-hover text-white flex items-center justify-center shadow-xl shadow-black/40 ring-4 ring-accent/20 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </Link>
    </div>
  )
}
