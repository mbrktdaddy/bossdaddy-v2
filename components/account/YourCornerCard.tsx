// "Your corner" on the account page — the entry point connections were missing.
//
// The list shipped reachable only from the header avatar dropdown, which is the
// weakest placement a destination can have. Every product with this concept makes
// the COUNT the entry point — "500+ connections", follower counts, "1,204
// friends" — because the number is what people look for and clicking it is what
// they expect to work. This is that.
//
// The toggles stay in ConnectionPrefs and this stays separate on purpose: settings
// holds POLICY ("who can send you requests"), the product holds the LIST. LinkedIn
// and Facebook both draw the line in the same place, and collapsing it would mean
// managing people inside a preferences screen.
//
// Server component — one cheap read on a page that is already doing several.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConnections, listIncoming } from '@/lib/connections'

export default async function YourCornerCard() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  const [connected, incoming] = await Promise.all([
    listConnections(supabase, user.id),
    listIncoming(supabase, user.id),
  ])

  return (
    <Link
      href="/account/connections"
      className="block bg-surface border border-soft rounded-xl p-6 mb-6 hover:border-strong transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Your corner</p>
          <p className="mt-2 text-2xl font-black text-prose">
            {connected.length}
            <span className="ml-2 text-sm font-semibold text-muted">
              {connected.length === 1 ? 'connection' : 'connections'}
            </span>
          </p>
          <p className="mt-1 text-xs text-prose-faint leading-snug">
            {incoming.length > 0
              ? `${incoming.length} ${incoming.length === 1 ? 'person is' : 'people are'} waiting on you.`
              : 'Who you can message and share a goal with.'}
          </p>
        </div>

        {/* The count of people waiting is the only thing on this page worth a
            colour — it's the one state that needs an action from him. */}
        {incoming.length > 0 ? (
          <span className="shrink-0 inline-flex min-w-8 items-center justify-center rounded-full bg-accent px-2.5 py-1 text-sm font-black text-white">
            {incoming.length}
          </span>
        ) : (
          <span className="shrink-0 text-muted" aria-hidden="true">→</span>
        )}
      </div>
    </Link>
  )
}
