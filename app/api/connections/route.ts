import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  requestConnection, respondToConnection, removeConnection,
  blockAndDisconnect, unblock,
} from '@/lib/connections'

// Every mutation on a connection. One route with an `op`, mirroring
// /api/goals/share — four endpoints doing identical auth and redirecting to the
// same page would drift apart within a month.
//
// POST → 303 → GET, so a refresh can't re-submit. That matters more here than
// usual: a re-posted "request" is a second ask at somebody who hasn't answered
// the first, which is the exact behaviour the cooldown exists to prevent.
//
// The forms POST urlencoded, so all of this works with JavaScript disabled.
//
// WHAT THIS ROUTE DOES NOT DO: tell anyone they were declined. requestConnection
// and respondToConnection own the notification decisions (accepts notify,
// declines never do — migration 140 rule 4). Don't add a notify call here.

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const op = String(form.get('op') ?? '')
  const otherUserId = String(form.get('userId') ?? '')

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/account/connections', request.url), 303)
  }
  if (!otherUserId) return back(request)

  // The requester's own name, for whatever notification the domain service
  // decides to send. Read once here rather than inside lib/connections so the
  // service stays a pure domain layer with no opinion about profiles.
  const { data: me } = await supabase
    .from('profiles').select('username, display_name').eq('id', user.id).maybeSingle()
  const myName = me?.display_name?.trim() || (me?.username ? `@${me.username}` : 'A Boss Daddy member')

  switch (op) {
    case 'request': {
      // The app's one remaining cold-contact surface — see lib/rate-limit.ts.
      const { success } = await checkRateLimit(user.id, 'connection-request')
      if (!success) return back(request, 'That\'s a lot of requests today. Try again tomorrow.')

      const result = await requestConnection(supabase, { myUserId: user.id, otherUserId, myName })
      if (!result.ok) return back(request, result.error)
      return back(request, result.state === 'accepted'
        ? 'You both asked — you\'re connected.'
        : 'Asked. You\'ll hear when they answer.')
    }

    case 'accept':
    case 'decline': {
      const result = await respondToConnection(supabase, {
        otherUserId, accept: op === 'accept', myName,
      })
      if (!result.ok) return back(request, result.error)
      // The decline message is addressed to the DECLINER, who obviously knows.
      // Nothing goes the other way.
      return back(request, op === 'accept' ? 'Connected.' : 'Turned down. They aren\'t told.')
    }

    // Withdraw and remove are the same delete — RLS decides which policy lets it
    // through, so the caller doesn't need to know which of the two they are.
    case 'withdraw':
    case 'remove': {
      await removeConnection(supabase, { userId: user.id, otherUserId })
      return back(request, op === 'withdraw' ? 'Request pulled back.' : 'Disconnected.')
    }

    case 'block': {
      await blockAndDisconnect(supabase, { userId: user.id, otherUserId })
      // Say the cascade out loud. Someone blocking a person who was watching
      // their medication log deserves to know that stopped too, rather than
      // having to go and check.
      return back(request, 'Blocked. Any sharing between you has ended.')
    }

    case 'unblock': {
      await unblock(supabase, { userId: user.id, otherUserId })
      return back(request, 'Unblocked. You aren\'t connected — either of you can ask.')
    }

    default:
      return back(request)
  }
}

/** 303 so the browser follows with GET and a refresh can't re-POST. */
function back(request: NextRequest, msg?: string): NextResponse {
  const url = new URL('/account/connections', request.url)
  if (msg) url.searchParams.set('msg', msg)
  return NextResponse.redirect(url, 303)
}
