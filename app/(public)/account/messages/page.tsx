import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor } from '@/lib/messaging-queries'
import MemberSearch from './_components/MemberSearch'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false, follow: false },
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/account/messages')

  const conversations = await listConversationsFor(supabase, user.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-black text-prose mb-4">Messages</h1>

      {/* Compose — the obvious "start a conversation" entry point. */}
      <div className="bg-surface border border-soft rounded-xl p-4 sm:p-5">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">New message</p>
        <MemberSearch />
      </div>

      <div className="mt-6 divide-y divide-soft border border-soft rounded-xl overflow-hidden">
        {conversations.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-prose-faint">
            No conversations yet — use <span className="font-semibold text-prose">New message</span> above to start one.
          </p>
        ) : (
          conversations.map((c) => {
            const name = c.peer?.displayName || c.peer?.username || 'Member'
            return (
              <Link
                key={c.id}
                href={`/account/messages/${c.id}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface-raised transition-colors ${c.unread ? 'bg-accent-tint/40' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">{name}</p>
                  {c.lastMessage && (
                    <p className="text-xs text-prose-muted truncate">
                      {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.body}
                    </p>
                  )}
                </div>
                {c.unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0" />}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
