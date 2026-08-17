import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor } from '@/lib/messaging-queries'
import MemberSearch from '@/components/members/MemberSearch'
import ConversationList from './_components/ConversationList'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false, follow: false },
}

export default async function MessagesPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/account/messages')

  // Fetched on the server so the first paint carries real rows (no spinner, no
  // layout jump); ConversationList takes over from here and keeps them live.
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
        <ConversationList initial={conversations} userId={user.id} />
      </div>
    </div>
  )
}
