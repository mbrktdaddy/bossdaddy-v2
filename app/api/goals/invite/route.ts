import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { acceptInvitation, declineInvitation } from '@/lib/goals/participants'
import { revalidateGoal } from '@/lib/goals/revalidate'

// Accepting or declining an invite to watch someone's goal.
//
// Separate from /api/goals/share because this is the INVITEE acting, not the owner:
// the caller doesn't own the goal, isn't a participant yet, and is identified by a
// token rather than by any row RLS could match. Folding it into the owner's route
// would mean one handler where half the ops authorize one way and half the other.
//
// The admin client is required and deliberate: `goal_participants` has NO insert
// policy, precisely so that accepting an invitation is the only way to become one.
// If a client could insert there, anyone could add themselves to any goal whose id
// they could guess. Every check that matters — token validity, expiry, single use,
// self-invite, and a block in either direction — happens inside acceptInvitation.
//
// POST → 303 → GET, so a refresh can't replay the accept.

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const op = String(form.get('op') ?? '')
  const token = String(form.get('token') ?? '')
  const invitePath = `/goals/invite/${encodeURIComponent(token)}`

  if (!token) return redirectTo(request, '/goals')

  const admin = createAdminClient()

  // Declining needs no session: turning down an invite is an answer anyone holding
  // the link can give, and requiring sign-in first would be a strange gate on "no".
  if (op === 'decline') {
    await declineInvitation(admin, token)
    // No goal id: a decline is silent by design and the owner is never told, so
    // only the shared surfaces need re-rendering.
    revalidateGoal(null)
    return redirectTo(request, '/goals/shared?declined=1')
  }

  if (op !== 'accept') return redirectTo(request, invitePath)

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    // Back to the invite page, which offers sign-in and returns here after.
    return redirectTo(request, `/login?next=${encodeURIComponent(invitePath)}`)
  }

  const result = await acceptInvitation(admin, { token, userId: user.id })
  if (!result.ok) {
    const url = new URL(invitePath, request.url)
    url.searchParams.set('msg', result.reason)
    return NextResponse.redirect(url, 303)
  }

  // Accepting changes both sides: the owner's participant list and this partner's
  // /goals/shared index. revalidateGoal covers both.
  revalidateGoal(result.goalId)
  return redirectTo(request, `/goals/shared/${result.goalId}`)
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303)
}
