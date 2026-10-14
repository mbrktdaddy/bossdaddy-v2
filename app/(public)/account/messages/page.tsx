import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor } from '@/lib/messaging-queries'
import MemberSearch from '@/components/members/MemberSearch'
import ConversationList from './_components/ConversationList'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <PageHeader
        size="compact"
        back={{ href: '/account', label: LABELS.account.short }}
        eyebrow="Inbox"
        title="Messages"
        className="mb-6"
      />

      {/* Compose — the obvious "start a conversation" entry point. */}
      <Card tone="surface" className="p-6">
        <Eyebrow className="mb-3">New message</Eyebrow>
        <MemberSearch />
      </Card>

      <div className="mt-6">
        <ConversationList initial={conversations} userId={user.id} />
      </div>
    </div>
  )
}
