// Current user's conversation summaries for the header messages menu.

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listConversationsFor } from '@/lib/messaging-queries'

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await listConversationsFor(supabase, user.id)
  const unread = conversations.filter((c) => c.unread).length
  return NextResponse.json({ conversations, unread })
}
