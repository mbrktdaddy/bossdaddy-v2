'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Matches the Past chats list cap on the page — one "select all" never exceeds it.
const MAX_PER_CALL = 50

// Delete one or more of the member's saved Boss conversations (messages
// cascade). RLS already limits the delete to the member's own rows; the user_id
// filter makes that explicit, and `count` distinguishes "deleted" from "not
// yours / already gone" so the UI never reports a silent no-op as success.
export async function deleteBossConversations(ids: string[]): Promise<{ ok: boolean }> {
  const unique = [...new Set(ids)]
  if (unique.length === 0 || unique.length > MAX_PER_CALL || !unique.every((id) => UUID_RE.test(id))) {
    return { ok: false }
  }
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false }

  const { error, count } = await supabase
    .from('boss_conversations')
    .delete({ count: 'exact' })
    .in('id', unique)
    .eq('user_id', user.id)
  if (error || !count) return { ok: false }

  revalidatePath('/tools/the-boss')
  return { ok: true }
}
