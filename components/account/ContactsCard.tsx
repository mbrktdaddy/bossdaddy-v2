// Contacts — the count, and the way into the list.
//
// Renamed from YourCornerCard, because it was mislabelled: it counts accepted
// connections, and a connection means "we can message each other and I could ask
// you", not "you have my back". Your corner is a different and smaller set —
// see YourCornerSection, which derives it from goal_participants.
//
// The COUNT is the entry point on purpose. Every product with this concept makes
// the number clickable — "500+ connections", follower counts, "1,204 friends" —
// because that's what people look for and what they expect to work. The list
// shipped reachable only from the header avatar dropdown, which is why it
// couldn't be found.
//
// Server component; one cheap read on a page already doing several.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConnections, listIncoming } from '@/lib/connections'
import { LABELS } from '@/lib/labels'

export default async function ContactsCard() {
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
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.contacts.short}
          </p>
          {/* A LITERAL SPACE, not just `ml-2`. The margin looks right on screen and
              vanishes from copied text and from some screen readers, which announce
              adjacent inline elements with no separator — "3contacts". The gap is now
              a real character, with a smaller margin so the width is unchanged. */}
          <p className="mt-2 text-2xl font-black text-prose">
            {connected.length}{' '}
            <span className="ml-0.5 text-sm font-semibold text-prose-muted">
              {connected.length === 1 ? 'contact' : 'contacts'}
            </span>
          </p>
          <p className="mt-1 text-xs text-prose-faint leading-snug">
            {incoming.length > 0
              ? `${incoming.length} ${incoming.length === 1 ? 'person is' : 'people are'} waiting on you.`
              : 'Who you can message, and who you can ask to keep you honest.'}
          </p>
        </div>

        {/* The waiting count is the only thing here worth a colour — it's the one
            state that needs something from him. */}
        {incoming.length > 0 ? (
          <span className="shrink-0 inline-flex min-w-8 items-center justify-center rounded-full bg-accent px-2.5 py-1 text-sm font-black text-white">
            {incoming.length}
          </span>
        ) : (
          <span className="shrink-0 text-prose-muted" aria-hidden="true">→</span>
        )}
      </div>
    </Link>
  )
}
