import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// Thumbs up/down on a persisted assistant turn. Members only — visitor turns are
// ephemeral (never written to boss_messages), so there is nothing to rate. The
// RLS-scoped client enforces ownership: a member can only touch their own rows,
// so a bad messageId simply matches zero rows → 404. `feedback: null` clears it.
const BodySchema = z.object({
  messageId: z.string().uuid(),
  feedback: z.enum(['up', 'down']).nullable(),
})

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return NextResponse.json({ error: 'Sign in to rate a reply.' }, { status: 401 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { messageId, feedback } = parsed.data

  const { data, error } = await supabase
    .from('boss_messages')
    .update({
      feedback,
      feedback_at: feedback ? new Date().toISOString() : null,
    })
    .eq('id', messageId)
    .eq('role', 'assistant') // only assistant turns are ratable
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  if (!data) {
    // RLS hid the row (not the owner) or it does not exist / is not an assistant turn.
    return NextResponse.json({ error: 'Message not found.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, feedback })
}
