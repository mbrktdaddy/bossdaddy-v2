import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// Create or reset the calendar subscription link.
//
// Two ops, one behaviour: both write a fresh random token. "Create" and "reset" only
// differ in whether a row already existed, so upsert covers both and there's no
// branch that could leave someone without a feed.
//
// ROTATING IS THE ONLY REVOCATION THERE IS. The feed URL is a bearer credential
// held by Google's or Apple's servers, and it carries real goal titles — so this
// route is the one thing standing between a leaked link and someone reading a man's
// medication schedule. It takes effect on the next poll.
//
// The token value is generated HERE, never accepted from the client: a
// client-supplied token is a client-chosen password.
//
// POST → 303 → GET so a refresh can't silently mint a third token and orphan the
// one he just pasted into his calendar.

const TOKEN_BYTES = 32

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const op = String(form.get('op') ?? '')

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)
  }

  if (op !== 'create' && op !== 'reset' && op !== 'remove') {
    return back(request)
  }

  // Unsubscribing entirely: delete the row and the feed 404s from the next poll on.
  // Worth having as its own op — "I don't want this link to exist" is a different
  // intent from "give me a different one", and only one of them leaves a live
  // credential behind.
  if (op === 'remove') {
    const { error } = await supabase
      .from('goal_calendar_tokens')
      .delete()
      .eq('user_id', user.id)
    if (error) {
      console.error('goals calendar: remove failed', error.message)
      return back(request, 'Could not turn that off. Try again.')
    }
    return back(request, 'Calendar link is off. Any calendar still subscribed will stop updating.')
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url')

  // Upsert on the primary key, so "create" and "reset" are the same statement.
  // rotated_at stays null on the first create — it means "this has been reset",
  // which is what makes a leak diagnosable next to last_used_at.
  const { error } = await supabase
    .from('goal_calendar_tokens')
    .upsert(
      {
        user_id: user.id,
        token,
        ...(op === 'reset' ? { rotated_at: new Date().toISOString() } : {}),
        // Clear the usage stamp on rotate: after this, any poll recorded is a poll
        // of the NEW link, so the old one's activity can't be mistaken for current.
        last_used_at: null,
      },
      { onConflict: 'user_id' },
    )
  if (error) {
    console.error('goals calendar: upsert failed', error.message)
    return back(request, 'Could not set that up. Try again.')
  }

  return back(
    request,
    op === 'reset'
      ? 'New link ready. The old one stops working on the next check.'
      : undefined,
  )
}

/** 303 back to the goals index, where the panel lives. */
function back(request: NextRequest, msg?: string): NextResponse {
  const url = new URL('/goals', request.url)
  if (msg) url.searchParams.set('msg', msg)
  // The panel is collapsed by default; this brings him back to it opened.
  url.hash = 'calendar'
  return NextResponse.redirect(url, 303)
}
