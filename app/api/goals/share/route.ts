import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  createInvitation, revokeInvitation, removeParticipant, setParticipantTier,
  isShareTier, isThreadAccess,
} from '@/lib/goals/participants'
import { isInvitableContact } from '@/lib/goals/contacts'
import { deliverGoalInvite, type DeliveryOutcome } from '@/lib/goals/invite-delivery'
import { revalidateGoal } from '@/lib/goals/revalidate'

// Every mutation on who can see a goal. One route with an `op`, mirroring
// /api/goals/schedule — the alternative is four endpoints that all do the same
// auth, all redirect to the same page, and drift apart.
//
// WHY A ROUTE HANDLER AND NOT SERVER ACTIONS: POST → 303 → GET. A refresh can't
// re-submit the form, which here is the difference between one invite and three.
// These also need to redirect carrying a message — a fresh token to copy, or the
// reason a tier change was refused — and a NextResponse.redirect is a real
// Response object that nothing in the render path can intercept.
//
// NOTE for whoever reads /api/goals/create's version of this comment: it claims
// next/navigation's redirect() is "swallowed by this project's Sentry
// instrumentation". That cause is unverified and looks wrong — instrumentation.ts
// is the stock `Sentry.captureRequestError`, which re-throws Next's control-flow
// errors, and sentry.server.config.ts has no beforeSend or ignoreErrors. The
// original finding was about Server COMPONENTS, not actions, and no Server Action
// in this repo has ever called redirect(). The 303 reasoning above stands on its
// own either way, so nothing here depends on settling it.
//
// The forms POST urlencoded, so all of this works with JavaScript disabled.
//
// NOTHING ON THIS ROUTE EVER SENDS ANYTHING EXCEPT THE INVITE ITSELF. One email,
// or one notification, at the moment the owner asks for it — see lib/goals/invite-
// delivery.ts. After that this route is silent, to anybody, in either direction,
// forever. No "he missed his meds", no "she stopped watching", no digest. That
// silence is the feature (migration 137's header has the reasoning); sharing state
// is something you see by looking, which is what keeps this accountability rather
// than surveillance. Revoking and leaving stay silent on both sides.
//
// ⚠️ THE ONE THING THAT DOES NOTIFY, AND WHY IT ISN'T A HOLE IN THE ABOVE:
//    posting to a goal's notes feed (migration 145) pings the other people in it.
//    The distinction is not a loophole, it's the whole line — THE SYSTEM NEVER
//    REPORTS ON YOU; PEOPLE MAY SPEAK TO YOU. A cron telling your wife you missed
//    a dose is surveillance. Your wife typing "proud of you" is a message, and
//    swallowing it isn't privacy, it's just a dead feed. The goals sweep's
//    recipient lookup remains owner-only and is not touched by any of this.
//
// `thread_access` is granted HERE, alongside the tier, and is the only thing that
// can turn a private journal into a conversation. It defaults to 'none': sharing a
// goal is not sharing the journal.

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const op = String(form.get('op') ?? '')
  const goalId = String(form.get('goalId') ?? '')

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)
  }
  if (!goalId) return back(request, '/goals')

  switch (op) {
    // ── invite ──────────────────────────────────────────────────────────────
    case 'invite': {
      const tier = String(form.get('tier') ?? 'cheer')
      if (!isShareTier(tier)) return back(request, sharePath(goalId), 'Pick what they can see.')

      // Absent field → 'none'. A form that forgets to render the control must
      // fall through to the private default, never to an accidental grant.
      const threadAccess = String(form.get('threadAccess') ?? 'none')
      if (!isThreadAccess(threadAccess)) {
        return back(request, sharePath(goalId), 'Pick whether they can see your notes.')
      }

      const email = String(form.get('email') ?? '').trim()
      const contactUserId = String(form.get('contactUserId') ?? '').trim()

      // ONE FORM, THREE OUTCOMES, no client JavaScript. He picks a name, or types
      // an address, or does neither and just wants a link to paste. Branching here
      // rather than on the page is what lets a single submit button cover all
      // three — a <select> can't rewrite the form's `op` without script.
      //
      // THE CONTACT ID IS UNTRUSTED. Re-derived from his actual DM threads, with
      // blocks and existing participants excluded, before anything is delivered.
      if (contactUserId && !(await isInvitableContact(supabase, {
        userId: user.id, goalId, contactUserId,
      }))) {
        return back(request, sharePath(goalId), 'You can only pick someone you\'re connected to.')
      }

      // Rate-limit the SEND, not the mint: a copy-only link reaches nobody, so
      // there's nothing to throttle until we're about to put something in front
      // of a third party.
      if (email || contactUserId) {
        const { success } = await checkRateLimit(user.id, 'goal-invite')
        if (!success) {
          return back(request, sharePath(goalId), 'That\'s a lot of invites in one hour. Try again later.')
        }
      }

      const result = await createInvitation(supabase, {
        goalId,
        userId: user.id,
        tier,
        email,
        // Verified against his real contacts by isInvitableContact above, so this
        // is safe to persist as the invite's intended recipient (migration 144).
        inviteeUserId: contactUserId || null,
        threadAccess,
        // The owner's explicit acknowledgement on a sensitive goal. The domain
        // service refuses a non-cheer invite, OR any feed grant, without it.
        sensitiveAck: String(form.get('sensitiveAck') ?? '') === 'yes',
      })

      if (!result.ok) return back(request, sharePath(goalId), result.error)

      // Delivery is best-effort and deliberately AFTER the invite exists. If a
      // send fails he still has the link on screen, which is exactly the old
      // behaviour — the feature degrades to what it was rather than to nothing.
      let sent: DeliveryOutcome = 'none'
      if (email || contactUserId) {
        const [{ data: goalRow }, { data: me }] = await Promise.all([
          supabase.from('goals').select('title').eq('id', goalId).maybeSingle(),
          supabase.from('profiles').select('username, display_name').eq('id', user.id).maybeSingle(),
        ])
        const profile = me as { username: string | null; display_name: string | null } | null
        sent = await deliverGoalInvite({
          token: result.token,
          tier,
          senderUserId: user.id,
          goalTitle: (goalRow as { title: string } | null)?.title ?? 'a goal',
          inviterName: profile?.display_name?.trim()
            || (profile?.username ? `@${profile.username}` : 'A Boss Daddy member'),
          email: email || null,
          memberUserId: contactUserId || null,
        })
      }

      // The token rides in the URL so the page can show the link ONCE, to copy.
      // It's already stored, so a reload just shows it in the pending list.
      const url = new URL(sharePath(goalId), request.url)
      url.searchParams.set('token', result.token)
      if (sent !== 'none') url.searchParams.set('sent', sent)
      return NextResponse.redirect(url, 303)
    }

    // ── call back an unused invite ──────────────────────────────────────────
    case 'revoke_invite': {
      const invitationId = String(form.get('invitationId') ?? '')
      if (invitationId) await revokeInvitation(supabase, invitationId)
      return back(request, sharePath(goalId))
    }

    // ── end a share ─────────────────────────────────────────────────────────
    // ONE op for both directions. RLS carries a self-leave policy and an
    // owner-revoke policy, so whichever the caller is, the delete removes exactly
    // the row they're entitled to remove — and a caller who is neither removes
    // nothing. Silent either way: needing permission to stop watching someone's
    // medication log would be its own kind of trap, and a "you were removed"
    // notice is a hazard in exactly the case where revoking matters most.
    case 'end_share': {
      const participantUserId = String(form.get('participantUserId') ?? '')
      if (!participantUserId) return back(request, sharePath(goalId))

      await removeParticipant(supabase, { goalId, userId: participantUserId })

      // A partner who just left can no longer read the goal, so send them to the
      // list rather than a page that would render as "not shared with you".
      const leaving = participantUserId === user.id
      return back(request, leaving ? '/goals#corner' : sharePath(goalId))
    }

    // ── change what an existing partner sees ────────────────────────────────
    case 'set_tier': {
      const participantUserId = String(form.get('participantUserId') ?? '')
      const tier = String(form.get('tier') ?? '')
      if (!participantUserId || !isShareTier(tier)) return back(request, sharePath(goalId))

      // ABSENT ≠ 'none' ON THIS OP. Unlike the invite above, this is an edit to a
      // row that already exists: a form that submits only a tier must leave the
      // feed exactly as it was. Passing undefined tells the domain service not to
      // touch the column at all.
      const rawAccess = form.get('threadAccess')
      const threadAccess = rawAccess === null ? undefined : String(rawAccess)
      if (threadAccess !== undefined && !isThreadAccess(threadAccess)) {
        return back(request, sharePath(goalId))
      }

      const result = await setParticipantTier(supabase, {
        goalId,
        userId: participantUserId,
        tier,
        threadAccess,
        sensitiveAck: String(form.get('sensitiveAck') ?? '') === 'yes',
      })
      return back(request, sharePath(goalId), result.ok ? undefined : result.error)
    }

    default:
      return back(request, sharePath(goalId))
  }
}

function sharePath(goalId: string): string {
  return `/goals/${goalId}/share`
}

/**
 * 303 so the browser follows with GET and a refresh can't re-POST the form.
 *
 * Revalidates on the way out, unconditionally. Every op that reaches here either
 * changed the participant list or was refused, and re-rendering after a refusal
 * costs one render — while missing one leaves the share page insisting somebody is
 * still a teammate after they were removed.
 */
function back(request: NextRequest, path: string, msg?: string): NextResponse {
  revalidateGoal(goalIdFromSharePath(path))
  const url = new URL(path, request.url)
  if (msg) url.searchParams.set('msg', msg)
  return NextResponse.redirect(url, 303)
}

/** `/goals/<id>/share` → `<id>`. Null for any other path, which revalidates the
 *  shared surfaces only. */
function goalIdFromSharePath(path: string): string | null {
  return /^\/goals\/([0-9a-f-]{36})\/share$/i.exec(path)?.[1] ?? null
}
