// Current user's conversation summaries for the header messages menu.

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor, badgeUnreadCount } from '@/lib/messaging-queries'

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await listConversationsFor(supabase, user.id)
  // badgeUnreadCount, not a local filter: it also drops muted threads, and the
  // bell and the /account tile must never disagree about the number.
  return NextResponse.json({ conversations, unread: badgeUnreadCount(conversations) })
}
