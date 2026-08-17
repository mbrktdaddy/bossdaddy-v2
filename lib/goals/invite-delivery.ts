// Getting an invite to the person it's for.
//
// Until now the share page minted a token and left delivery entirely to the owner:
// copy the link, text it yourself. That was a deliberate privacy stance — "we never
// put a cessation goal in someone's inbox without him choosing to" — but pressing a
// send button IS choosing, and the copy-a-path-and-paste-it step was friction on
// the one action the whole feature depends on.
//
// So this sends. Two channels, either or both:
//   • EMAIL, when he typed an address. Carries the real goal title (operator
//     decision, same call as the .ics feed) and the exact tier copy he picked.
//   • IN-APP, when he picked someone he already talks to. They're a member; the
//     notification bell is precisely the surface for this, and it needs no address.
//     We email those too when the address resolves, because a notification nobody
//     opens for a week isn't accountability.
//
// ⚠️ THIS IS THE ONLY MESSAGE A PARTNER EVER GETS. Migration 137 forbids notifying
// participants about goal activity — no "he missed his meds", ever, in either
// direction. That rule is about the ONGOING relationship; this is the one-time ask
// that creates it, sent by the owner, about his own goal. scripts/check-goals-
// identity.mjs guards the outbox surfaces (sweep, push, lib/email.ts, emails/**)
// and this file is deliberately not one of them — but if you ever find yourself
// importing goal_participants here to tell somebody something, stop.
//
// Nothing here throws. A failed send must not cost the owner his invite: the token
// is already stored and the link is already on screen, so the worst case degrades
// to exactly the old behaviour.

import 'server-only'
import { SITE_URL } from '@/lib/og'
import { TIER_COPY, type ShareTier } from '@/lib/goals/participants'

export type DeliveryOutcome = 'email' | 'member' | 'none'

export function goalInviteUrl(token: string): string {
  return `${SITE_URL}/goals/invite/${token}`
}

export async function deliverGoalInvite(args: {
  token: string
  tier: ShareTier
  goalTitle: string
  inviterName: string
  /** Who is sending — needed to honour the recipient's preferences. */
  senderUserId: string
  /** A typed-in address, or null. */
  email?: string | null
  /** A member picked from his contacts, or null. */
  memberUserId?: string | null
}): Promise<DeliveryOutcome> {
  const url = goalInviteUrl(args.token)
  const copy = TIER_COPY[args.tier]
  let outcome: DeliveryOutcome = 'none'

  // MAY WE PUT THIS IN FRONT OF THEM AT ALL? The contact picker only offers
  // connections, so that path is already consensual — but the email field takes
  // any address, and without this a member who set "nobody can ask" is reachable
  // by anyone who knows their address. Returning 'none' degrades to "here's a
  // link you can pass on", which is what the sender sees for a blank address or a
  // Resend failure too — so a refusal reveals nothing. See lib/invite-guard.ts.
  const { mayInviteEmail, mayInviteMember } = await import('@/lib/invite-guard')
  if (args.memberUserId && !await mayInviteMember(args.memberUserId, args.senderUserId)) {
    return 'none'
  }
  if (!args.memberUserId && args.email && !await mayInviteEmail(args.email, args.senderUserId)) {
    return 'none'
  }

  // ── the member's in-app notification ──────────────────────────────────────
  // `link` is a PATH, not the absolute URL: this one is opened from inside the
  // app, and a same-origin href keeps it a client navigation.
  if (args.memberUserId) {
    const { createNotification } = await import('@/lib/notifications')
    const res = await createNotification({
      userId: args.memberUserId,
      type: 'goal_invite',
      title: `${args.inviterName} wants you in his corner`,
      body: `${args.goalTitle} — ${copy.label.toLowerCase()}. ${copy.sees}`,
      link: `/goals/invite/${args.token}`,
    })
    if (res.ok) outcome = 'member'
  }

  // ── the email ─────────────────────────────────────────────────────────────
  const to = args.email?.trim() || (args.memberUserId ? await lookupEmail(args.memberUserId) : null)
  if (to) {
    // Lazy so the test runtime and the client bundle never pull React Email in —
    // same reason lib/dad-tools/savings-actions.ts does it this way.
    const [{ sendEmail }, { GoalInviteEmail }, React] = await Promise.all([
      import('@/lib/email'),
      import('@/emails/GoalInviteEmail'),
      import('react'),
    ])
    // THE RETURN VALUE DECIDES THE COPY. sendEmail swallows a missing
    // RESEND_API_KEY and a Resend rejection into { ok: false } rather than
    // throwing, so ignoring it would put "Sent. It's on its way to their inbox."
    // on screen for a mail that never left — the exact silent-success shape that
    // hid the empty calendar feed. When it fails we fall back to "here's the
    // link", which is true and still gets the job done.
    const res = await sendEmail({
      to,
      subject: `${args.inviterName} invited you to his "${args.goalTitle}" goal`,
      tag: 'goal_invite',
      // A person-to-person invite with a 7-day expiry can't afford Gmail's
      // Promotions tab — naming the inviter is the strongest nudge toward Primary.
      fromName: args.inviterName,
      react: React.createElement(GoalInviteEmail, {
        inviterName: args.inviterName,
        goalTitle: args.goalTitle,
        tierLabel: copy.label,
        tierSees: copy.sees,
        tierBlind: copy.blind,
        acceptUrl: url,
        siteUrl: SITE_URL,
      }),
    }).catch((err) => {
      console.error('goal invite email send failed', err)
      return { ok: false as const, error: String(err) }
    })
    if (!res.ok) console.error('goal invite email not sent —', res.error)
    else if (outcome === 'none') outcome = 'email'
  }

  return outcome
}

/**
 * A member's address, for the second channel on a contact invite.
 *
 * Needs the admin client because addresses live in `auth.users`, which no session
 * client can read. Returns null on any failure — an unreachable inbox is not a
 * reason to fail an invite that already landed in their notifications.
 */
async function lookupEmail(userId: string): Promise<string | null> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const { data, error } = await createAdminClient().auth.admin.getUserById(userId)
    if (error) return null
    return data.user?.email ?? null
  } catch {
    return null
  }
}
