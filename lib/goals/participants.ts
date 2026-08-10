// Accountability partners — the domain service behind sharing a goal.
//
// The doctrine lives in migration 137's header; this file is what enforces the
// parts SQL can't. Three things in particular:
//
//   • OPT-IN IS THE ONLY WAY IN. `goal_participants` has no INSERT policy, so a
//     row can only be written here, after a token has been checked for validity,
//     expiry, single-use, and a block between the two people.
//   • EITHER SIDE CAN END IT. `removeParticipant` is one function for both leaving
//     and revoking, because RLS already carries two DELETE policies and the caller
//     doesn't need to know which one let it through.
//   • CHEER AND WITNESS NEVER TOUCH THE BASE TABLES. The read helpers below select
//     from `goal_share_summary` / `goal_share_days` — the definer views that do the
//     column filtering. Reaching for `goals` or `goal_entries` in a partner-facing
//     path would hand over the numbers and the identity statement.
//
// NOTHING HERE NOTIFIES ANYBODY. Not the invitee, not the owner, in either
// direction. Sharing state is visible in-app by looking; a push saying "he missed
// his meds" is the surveillance product this design refuses to be.

import 'server-only'
import { randomBytes } from 'node:crypto'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const TIERS = ['cheer', 'witness', 'teammate'] as const
export type ShareTier = (typeof TIERS)[number]

/** Days an invitation stays good for. Matches the savings invite window. */
const INVITE_TTL_DAYS = 7

/**
 * Exactly what each tier lets a partner see, in the words the invitee reads
 * before accepting. This is the informed half of informed consent, so it lives
 * next to the code that grants the access rather than in a template someone can
 * reword without noticing the mismatch.
 */
export const TIER_COPY: Record<ShareTier, { label: string; sees: string; blind: string }> = {
  cheer: {
    label: 'Cheer him on',
    sees: 'That the goal exists, how long his run is, and how the plan is going.',
    blind: 'Not the day-by-day. Not any numbers, notes, or slips.',
  },
  witness: {
    label: 'Be his witness',
    sees: 'Everything above, plus each day marked done, missed, or skipped.',
    blind: 'Still no numbers, no notes, and nothing he wrote down privately.',
  },
  teammate: {
    label: 'Do it with him',
    sees: 'The whole goal — every day, every number, every note.',
    blind: 'For goals you are genuinely in together.',
  },
}

export type SharedGoalSummary = {
  goalId: string
  ownerId: string
  title: string
  kind: string
  status: string
  startedOn: string
  targetDate: string | null
  streak: number | null
  loggedDone: number | null
  loggedTotal: number | null
  openCount: number | null
  myTier: ShareTier
}

/** Goals other people have shared with me. Reads the view, never the base table. */
export async function listSharedWithMe(client: Queryable): Promise<SharedGoalSummary[]> {
  const { data, error } = await client
    .from('goal_share_summary')
    .select('goal_id, owner_id, title, kind, status, started_on, target_date, streak, logged_done, logged_total, open_count, my_tier')
    .order('title', { ascending: true })
  if (error) {
    console.error('goal shares: summary read failed —', error.message)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    goalId: String(r.goal_id),
    ownerId: String(r.owner_id),
    title: String(r.title),
    kind: String(r.kind),
    status: String(r.status),
    startedOn: String(r.started_on),
    targetDate: (r.target_date as string | null) ?? null,
    streak: (r.streak as number | null) ?? null,
    loggedDone: (r.logged_done as number | null) ?? null,
    loggedTotal: (r.logged_total as number | null) ?? null,
    openCount: (r.open_count as number | null) ?? null,
    myTier: (r.my_tier as ShareTier) ?? 'cheer',
  }))
}

/** One shared goal, or null when I'm not a participant on it. */
export async function getSharedGoal(
  client: Queryable,
  goalId: string,
): Promise<SharedGoalSummary | null> {
  const all = await listSharedWithMe(client)
  return all.find((g) => g.goalId === goalId) ?? null
}

export type SharedDay = { localDate: string; state: 'done' | 'missed' | 'skipped' | 'open' }

/**
 * The per-day calendar, for witness and above. Returns [] for a cheer partner —
 * the view's WHERE clause refuses them, so there's no branch to forget here.
 */
export async function listSharedDays(
  client: Queryable,
  goalId: string,
  limit = 90,
): Promise<SharedDay[]> {
  const { data, error } = await client
    .from('goal_share_days')
    .select('local_date, day_state')
    .eq('goal_id', goalId)
    .order('local_date', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('goal shares: days read failed —', error.message)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    localDate: String(r.local_date),
    state: r.day_state as SharedDay['state'],
  }))
}

export type ParticipantRow = {
  id: string
  userId: string
  tier: ShareTier
  joinedAt: string
  username: string | null
  displayName: string | null
}

/** Who's watching this goal. Owner-facing; RLS scopes it to goals he owns. */
export async function listParticipants(
  client: Queryable,
  goalId: string,
): Promise<ParticipantRow[]> {
  const { data, error } = await client
    .from('goal_participants')
    .select('id, user_id, tier, joined_at, profiles(username, display_name)')
    .eq('goal_id', goalId)
    .order('joined_at', { ascending: true })
  if (error) {
    console.error('goal shares: participants read failed —', error.message)
    return []
  }
  return (data ?? []).map((r: Record<string, unknown>) => {
    const profile = r.profiles as { username?: string | null; display_name?: string | null } | null
    return {
      id: String(r.id),
      userId: String(r.user_id),
      tier: r.tier as ShareTier,
      joinedAt: String(r.joined_at),
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
    }
  })
}

export type InvitationRow = {
  id: string
  tier: ShareTier
  email: string | null
  token: string
  expiresAt: string
  state: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired'
}

/** Invitations the owner has sent on this goal, newest first. */
export async function listInvitations(
  client: Queryable,
  goalId: string,
): Promise<InvitationRow[]> {
  const { data, error } = await client
    .from('goal_invitations')
    .select('id, tier, invitee_email, token, expires_at, accepted_at, declined_at, revoked_at')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('goal shares: invitations read failed —', error.message)
    return []
  }
  const now = new Date()
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    tier: r.tier as ShareTier,
    email: (r.invitee_email as string | null) ?? null,
    token: String(r.token),
    expiresAt: String(r.expires_at),
    state: invitationState(
      {
        acceptedAt: (r.accepted_at as string | null) ?? null,
        declinedAt: (r.declined_at as string | null) ?? null,
        revokedAt: (r.revoked_at as string | null) ?? null,
        expiresAt: String(r.expires_at),
      },
      now,
    ),
  }))
}

/**
 * Which of the five states an invitation is in.
 *
 * PRECEDENCE MATTERS AND IT IS NOT ALPHABETICAL. An outcome always beats the
 * clock: an invite that was declined and then sat around past its expiry reads
 * "declined", because that's what happened, and showing it as merely expired would
 * tell the owner the wrong story about whether he was turned down. Migration 137's
 * CHECK guarantees at most one outcome is set, so the three outcome branches are
 * mutually exclusive by construction — the ordering here only decides what wins
 * against expiry.
 *
 * Pure, and separated from the query so this is testable.
 */
export function invitationState(
  row: {
    acceptedAt: string | null
    declinedAt: string | null
    revokedAt: string | null
    expiresAt: string
  },
  now: Date = new Date(),
): InvitationRow['state'] {
  if (row.acceptedAt) return 'accepted'
  if (row.declinedAt) return 'declined'
  if (row.revokedAt) return 'revoked'
  return new Date(row.expiresAt).getTime() < now.getTime() ? 'expired' : 'pending'
}

/**
 * Mint an invitation. Returns the token; the caller builds the link and decides how
 * it gets to the invitee (copy, text, email) — same as savings.
 *
 * The RLS insert policy already requires the caller to own the goal, so there is no
 * ownership check to forget here.
 */
export async function createInvitation(
  client: Queryable,
  args: {
    goalId: string
    userId: string
    tier: ShareTier
    email?: string | null
    /**
     * The member this invite is FOR, when picked from contacts (migration 144).
     * Verified server-side by isInvitableContact before it reaches here — never a
     * raw form value. NULL for a bare link invite, which stays a first-class case.
     */
    inviteeUserId?: string | null
    /** The owner's explicit "I understand what he'd see" on a sensitive goal. */
    sensitiveAck?: boolean
  },
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  // WHERE THE SENSITIVE CAP IS ACTUALLY DECIDED.
  //
  // Migration 137's trigger guarantees the END STATE: a participant row above
  // cheer on a sensitive goal cannot exist without `sensitive_ack`. But the
  // acknowledgement is the OWNER's decision, and by the time a row is written the
  // owner isn't the one acting — the invitee is. So the decision has to be captured
  // here, when he picks the tier and the UI has just told him what the partner
  // would see.
  //
  // The invitation therefore stands as the record of that choice, and accept
  // carries it onto the row. Residual gap, stated plainly: a hand-rolled POST that
  // skipped the checkbox could mint a witness invite on a sensitive goal, because
  // 137 has no `goal_invitations.sensitive_ack` column to constrain. Closing that
  // properly is one column in a later migration; until then this guard is the gate.
  if (args.tier !== 'cheer') {
    const { data } = await client
      .from('goals')
      .select('config')
      .eq('id', args.goalId)
      .maybeSingle()
    const sensitive = (data as { config?: { sensitive?: unknown } | null } | null)?.config?.sensitive === true
    if (sensitive && args.sensitiveAck !== true) {
      return {
        ok: false,
        error: 'That goal tracks something sensitive. Confirm what he\'d see before sharing more than your streak.',
      }
    }
  }

  const token = randomBytes(24).toString('base64url')
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString()

  // ⚠️ ONE LIVE INVITE PER ADDRESS, for the same reason as savings. Every mint is
  // another BEARER TOKEN, and revoking is per-row — so inviting the same person
  // three times and then calling one back leaves two links that still work. On a
  // sensitive goal that's an owner who thinks he's withdrawn access and hasn't.
  //
  // Revoked, not deleted: `revoked_at` is what makes invitationState() report
  // "called back" instead of silently losing the history.
  //
  // Covers BOTH addressing modes since migration 144 added invitee_user_id. A bare
  // link invite with neither is deliberately never deduped: two of those legitimately
  // mean two different people.
  //
  // Not merely tidiness — migration 144's partial unique indexes now REFUSE a second
  // live invite for the same recipient, so skipping this turns a repeat invite into
  // a 23505 instead of a replacement.
  const stale = client
    .from('goal_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('goal_id', args.goalId)
    .is('accepted_at', null)
    .is('declined_at', null)
    .is('revoked_at', null)

  if (args.inviteeUserId) {
    await stale.eq('invitee_user_id', args.inviteeUserId)
  } else if (args.email?.trim()) {
    await stale.eq('invitee_email', args.email.trim())
  }

  const { error } = await client.from('goal_invitations').insert({
    goal_id: args.goalId,
    invited_by: args.userId,
    invitee_email: args.email?.trim() || null,
    invitee_user_id: args.inviteeUserId || null,
    tier: args.tier,
    token,
    expires_at: expires,
  })
  if (error) {
    console.error('goal shares: invite insert failed —', error.message)
    return { ok: false, error: 'Could not create that invite.' }
  }
  return { ok: true, token }
}

export type InvitePreview = {
  invitationId: string
  goalId: string
  goalTitle: string
  tier: ShareTier
  inviterName: string
  expiresAt: string
  /** Set when the invite names a specific member (migration 144). */
  inviteeUserId: string | null
}

/**
 * What an invitee sees before deciding. Needs the ADMIN client: the invitee is not
 * a participant yet, so RLS on `goals` and `goal_invitations` would show them
 * nothing — the signed-in-ness isn't what authorizes this, the token is.
 *
 * Returns only the goal's TITLE. Not the metric, not the numbers, not the identity
 * statement: nobody sees inside a goal before they've accepted, and a leaky preview
 * would make the tiers meaningless.
 */
export async function previewInvitation(
  admin: Queryable,
  token: string,
  /**
   * Who is looking, if anyone. Only consulted for an ADDRESSED invite — see the
   * gate at the bottom of this function.
   */
  viewerId?: string | null,
): Promise<
  | { ok: true; preview: InvitePreview }
  | { ok: false; reason: string; needsSignIn?: true }
> {
  if (!token) return { ok: false, reason: 'That invite link is incomplete.' }

  const { data } = await admin
    .from('goal_invitations')
    .select('id, goal_id, tier, expires_at, accepted_at, declined_at, revoked_at, invited_by, invitee_user_id')
    .eq('token', token)
    .maybeSingle()
  const invite = data as {
    id: string; goal_id: string; tier: ShareTier; expires_at: string
    accepted_at: string | null; declined_at: string | null; revoked_at: string | null
    invited_by: string; invitee_user_id: string | null
  } | null

  if (!invite) return { ok: false, reason: 'That invite link isn\'t valid.' }
  if (invite.accepted_at) return { ok: false, reason: 'That invite has already been used.' }
  if (invite.declined_at) return { ok: false, reason: 'That invite was already turned down.' }
  if (invite.revoked_at) return { ok: false, reason: 'That invite was called back.' }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'That invite has expired. Ask him for a fresh one.' }
  }

  // ⚠️ AN ADDRESSED INVITE DOESN'T SHOW ITS GOAL TO STRANGERS.
  //
  // The accept path already refuses the wrong person, but refusing at accept is
  // one step too late: this function returns the goal TITLE, and the page renders
  // it. Forward a contact-addressed invite for "Quit smoking" and the wrong
  // person reads the title — they simply can't join. On a sensitive goal the
  // title IS the disclosure, which is the thing the tiers exist to control.
  //
  // Signed out, we can't tell who's looking, so an addressed invite asks them to
  // sign in FIRST. That costs nothing real: it was addressed to a member, so they
  // have an account. A bare link invite — no named recipient, token is the whole
  // addressing — still shows the full offer before asking for anything, because
  // "sign in to find out what this is" is how an invite gets abandoned.
  if (invite.invitee_user_id) {
    if (!viewerId) {
      return {
        ok: false,
        needsSignIn: true,
        reason: 'This invite was sent to someone in particular. Sign in and we\'ll show you.',
      }
    }
    if (viewerId !== invite.invitee_user_id) {
      // Same deliberate vagueness as the block check: naming who it WAS for tells
      // the wrong person something about the right one.
      return { ok: false, reason: 'That invite isn\'t valid.' }
    }
  }

  const [{ data: goalRow }, { data: inviterRow }] = await Promise.all([
    admin.from('goals').select('title').eq('id', invite.goal_id).maybeSingle(),
    admin.from('profiles').select('username, display_name').eq('id', invite.invited_by).maybeSingle(),
  ])
  const inviter = inviterRow as { username: string | null; display_name: string | null } | null

  return {
    ok: true,
    preview: {
      invitationId: invite.id,
      goalId: invite.goal_id,
      goalTitle: (goalRow as { title: string } | null)?.title ?? 'a goal',
      tier: invite.tier,
      inviterName: inviter?.display_name?.trim() || inviter?.username || 'A Boss Daddy member',
      expiresAt: invite.expires_at,
      inviteeUserId: invite.invitee_user_id,
    },
  }
}

/**
 * Accept — the only path that creates a participant row.
 *
 * Needs the ADMIN client for the same reason previewInvitation does, and because
 * `goal_participants` deliberately has no INSERT policy: if a client could insert
 * there, anyone could add themselves to any goal whose id they could name.
 *
 * REFUSES IF EITHER PARTY HAS BLOCKED THE OTHER (`user_blocks`, migration 083).
 * Checked in both directions: a man who blocked someone must not be watchable by
 * them, and someone who blocked him shouldn't be handed a window into his log.
 */
export async function acceptInvitation(
  admin: Queryable,
  args: { token: string; userId: string },
): Promise<{ ok: true; goalId: string } | { ok: false; reason: string }> {
  // The viewer MUST be passed here. previewInvitation refuses an addressed invite
  // to anyone it can't identify, so omitting it would turn away the very person
  // the invite names.
  const preview = await previewInvitation(admin, args.token, args.userId)
  if (!preview.ok) return { ok: false, reason: preview.reason }

  const { goalId, tier, invitationId } = preview.preview

  const { data: ownerRow } = await admin.from('goals').select('user_id').eq('id', goalId).maybeSingle()
  const ownerId = (ownerRow as { user_id: string } | null)?.user_id
  if (!ownerId) return { ok: false, reason: 'That goal is gone.' }

  if (ownerId === args.userId) {
    return { ok: false, reason: 'That\'s your own goal — you already see everything.' }
  }

  // ADDRESSED INVITES ARE FOR THE PERSON THEY NAME (migration 144).
  //
  // Until the column existed, whoever opened the link became the participant —
  // fine for "make me something I can text", wrong for an invite picked from
  // contacts, where the owner chose a specific person and a forwarded link would
  // quietly substitute someone else onto a medication log.
  //
  // Only enforced when set. A bare link invite still has the token as its only
  // addressing, which remains a deliberate, first-class case.
  if (preview.preview.inviteeUserId && preview.preview.inviteeUserId !== args.userId) {
    // Deliberately vague, same as the block check: confirming who it WAS for
    // tells the wrong person something about the right one.
    return { ok: false, reason: 'That invite can\'t be accepted.' }
  }

  const { data: blocks } = await admin
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(
      `and(blocker_id.eq.${ownerId},blocked_id.eq.${args.userId}),` +
      `and(blocker_id.eq.${args.userId},blocked_id.eq.${ownerId})`,
    )
  if ((blocks ?? []).length > 0) {
    // Deliberately vague: confirming a block to the other party is itself a leak.
    return { ok: false, reason: 'That invite can\'t be accepted.' }
  }

  // THE CONNECTION GATE. An accepted connection is the consent (migration 140);
  // a goal invite is what you do with it, not a way around it.
  //
  // This is also what closes the stale-token hole migration 141 left open. Ending
  // a connection cascades away the participant row, but the invite TOKEN survives
  // in whatever inbox it landed in, and without this check re-opening that link
  // would quietly re-establish everything that was just ended. The check belongs
  // here rather than in the cascade because this is the first moment the
  // invitee's identity is actually known — goal_invitations only ever held an
  // optional, unverified email.
  const [ca, cb] = [ownerId, args.userId].sort()
  const { data: connection } = await admin
    .from('user_connections')
    .select('status')
    .eq('user_a', ca)
    .eq('user_b', cb)
    .maybeSingle()
  if ((connection as { status: string } | null)?.status !== 'accepted') {
    return {
      ok: false,
      reason: 'Connect with them first, then this link will work.',
    }
  }

  // `sensitive_ack` mirrors the tier the OWNER chose at invite time, which
  // createInvitation only allows on a sensitive goal once he's confirmed what the
  // partner would see. The invitee never makes this call — it isn't theirs to make.
  const { error: insertError } = await admin.from('goal_participants').insert({
    goal_id: goalId,
    user_id: args.userId,
    tier,
    sensitive_ack: tier !== 'cheer',
    invited_by: ownerId,
  })
  if (insertError) {
    // 23505 = already a participant. Treat as success: the invite did what it said.
    if (insertError.code !== '23505') {
      console.error('goal shares: accept insert failed —', insertError.message)
      return { ok: false, reason: 'Couldn\'t join that goal. Try the link again.' }
    }
  }

  // Single-use. Stamped AFTER the participant row exists, so a failure above leaves
  // the invite usable rather than burning it.
  await admin
    .from('goal_invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invitationId)
    .is('accepted_at', null)

  return { ok: true, goalId }
}

/** Turn an invitation down. Recorded, not deleted — declined isn't expired. */
export async function declineInvitation(
  admin: Queryable,
  token: string,
): Promise<{ ok: boolean }> {
  const { error } = await admin
    .from('goal_invitations')
    .update({ declined_at: new Date().toISOString() })
    .eq('token', token)
    .is('accepted_at', null)
    .is('declined_at', null)
    .is('revoked_at', null)
  return { ok: !error }
}

/** The owner calls an unused invitation back. */
export async function revokeInvitation(
  client: Queryable,
  invitationId: string,
): Promise<{ ok: boolean }> {
  const { error } = await client
    .from('goal_invitations')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', invitationId)
    .is('accepted_at', null)
  return { ok: !error }
}

/**
 * End a share. ONE function for both directions on purpose: RLS carries a
 * self-leave policy and an owner-revoke policy, so whichever of the two the caller
 * is, this deletes exactly the rows they're allowed to and nothing else. A caller
 * who is neither deletes nothing.
 *
 * Silent, both ways. See migration 137.
 */
export async function removeParticipant(
  client: Queryable,
  args: { goalId: string; userId: string },
): Promise<{ ok: boolean }> {
  const { error } = await client
    .from('goal_participants')
    .delete()
    .eq('goal_id', args.goalId)
    .eq('user_id', args.userId)
  if (error) console.error('goal shares: remove failed —', error.message)
  return { ok: !error }
}

/**
 * Change what an existing partner can see. Owner-only by RLS; the sensitive cap
 * trigger still applies, so raising a sensitive goal above cheer requires the
 * acknowledgement to travel with the change.
 */
export async function setParticipantTier(
  client: Queryable,
  args: { goalId: string; userId: string; tier: ShareTier; sensitiveAck: boolean },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client
    .from('goal_participants')
    .update({ tier: args.tier, sensitive_ack: args.sensitiveAck })
    .eq('goal_id', args.goalId)
    .eq('user_id', args.userId)
  if (error) {
    // The trigger raises check_violation when the acknowledgement is missing.
    const missingAck = error.code === '23514' || /acknowledge/i.test(error.message ?? '')
    return {
      ok: false,
      error: missingAck
        ? 'That goal tracks something sensitive — confirm what he\'d see before going past cheering.'
        : 'Could not change that.',
    }
  }
  return { ok: true }
}

export function isShareTier(value: unknown): value is ShareTier {
  return typeof value === 'string' && (TIERS as readonly string[]).includes(value)
}
