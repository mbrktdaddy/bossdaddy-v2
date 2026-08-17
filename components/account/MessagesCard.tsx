// Messages — the count, and the way into the inbox.
//
// Sits beside ContactsCard on /account for the reason that card's own comment
// gives: "every product with this concept makes the number clickable." That was
// true of contacts and truer of unread messages, yet this page showed one and not
// the other — an asymmetry that was drift, not a decision. Contacts is who you CAN
// reach; this is who is actually waiting on a reply.
//
// The two cards are deliberately the same shape. A member scanning /account should
// read them as one row of counts, not two unrelated widgets.
//
// Server component; one read on a page already doing several.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor, badgeUnreadCount } from '@/lib/messaging-queries'

export default async function MessagesCard() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  const conversations = await listConversationsFor(supabase, user.id)
  // badgeUnreadCount, not a local filter — it drops muted threads, and a card
  // that disagreed with the header bell about the number would make both suspect.
  const waiting = badgeUnreadCount(conversations)

  return (
    <Link
      href="/account/messages"
      className="block bg-surface border border-soft rounded-xl p-6 mb-6 hover:border-strong transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">Messages</p>
          {/* A LITERAL SPACE, not just a margin — same reason as ContactsCard: the
              margin vanishes from copied text and some screen readers announce
              adjacent inline elements with no separator ("3conversations"). */}
          <p className="mt-2 text-2xl font-black text-prose">
            {conversations.length}{' '}
            <span className="ml-0.5 text-sm font-semibold text-prose-muted">
              {conversations.length === 1 ? 'conversation' : 'conversations'}
            </span>
          </p>
          <p className="mt-1 text-xs text-prose-faint leading-snug">
            {waiting > 0
              ? `${waiting} ${waiting === 1 ? 'thread is' : 'threads are'} waiting on you.`
              : 'Nothing unread. Your threads are here when you need them.'}
          </p>
        </div>

        {/* Unread is the only thing here worth a colour — it's the one state that
            needs something from him. Mirrors ContactsCard's waiting pill exactly. */}
        {waiting > 0 ? (
          <span className="shrink-0 inline-flex min-w-8 items-center justify-center rounded-full bg-accent px-2.5 py-1 text-sm font-black text-white">
            {waiting}
          </span>
        ) : (
          <span className="shrink-0 text-prose-muted" aria-hidden="true">→</span>
        )}
      </div>
    </Link>
  )
}
