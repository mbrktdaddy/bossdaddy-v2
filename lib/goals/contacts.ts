// "Someone in your corner" — the people a goal owner can invite without typing an
// email address.
//
// A CONTACT IS AN ACCEPTED CONNECTION (migration 140). This started out reading
// DM threads, which was the closest thing the app had to a relationship, but a DM
// thread only ever meant "one of us once typed the other's name" — anyone could
// open one with anyone. Connections are the real answer: mutual, explicitly
// accepted, and revocable by either side at any time.
//
// That also retires the per-feature opt-out this file was going to need. THE
// CONNECTION IS THE OPT-IN. A separate "can people invite me to goals" toggle
// would be a second answer to a question already answered, and the two would
// eventually disagree.
//
// EVERY EXCLUSION BELOW IS SECURITY, NOT TIDINESS:
//   • blocked in EITHER direction — belt and braces. Migration 140's trigger
//     already deletes the connection when a block is created, so a blocked pair
//     shouldn't have an accepted row at all; this catches the case where it
//     somehow does rather than trusting a trigger with a privacy boundary.
//   • already a participant — re-inviting someone already in would mint a second
//     live token for access they already have.
//   • himself — `goals` are owner-visible already, and acceptInvitation refuses it.
//
// The list is read with the CALLER'S client, so RLS scopes it to his own
// relationships. Never call this with the admin client.

import 'server-only'

/** Minimal client shape — mirrors lib/goals/participants.ts. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type GoalContact = {
  userId: string
  username: string | null
  displayName: string | null
  /** What to show in the picker. */
  label: string
}

/** Everyone this user could invite to this goal, alphabetically. */
export async function listGoalContacts(
  client: Queryable,
  args: { userId: string; goalId: string },
): Promise<GoalContact[]> {
  // RLS on user_connections already scopes this to rows he's part of, so the
  // .or() is about picking the right column to read the OTHER id out of, not
  // about authorization.
  const { data: rows } = await client
    .from('user_connections')
    .select('user_a, user_b')
    .eq('status', 'accepted')
    .or(`user_a.eq.${args.userId},user_b.eq.${args.userId}`)

  const peerIds = [...new Set(
    ((rows ?? []) as { user_a: string; user_b: string }[])
      .map((r) => (r.user_a === args.userId ? r.user_b : r.user_a)),
  )]
  if (peerIds.length === 0) return []

  const [{ data: blocks }, { data: already }, { data: profiles }] = await Promise.all([
    client
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${args.userId},blocked_id.eq.${args.userId}`),
    client
      .from('goal_participants')
      .select('user_id')
      .eq('goal_id', args.goalId),
    client
      .from('profiles')
      .select('id, username, display_name')
      .in('id', peerIds),
  ])

  const blocked = new Set<string>()
  for (const b of (blocks ?? []) as { blocker_id: string; blocked_id: string }[]) {
    blocked.add(b.blocker_id === args.userId ? b.blocked_id : b.blocker_id)
  }
  const participants = new Set(
    ((already ?? []) as { user_id: string }[]).map((p) => p.user_id),
  )

  return ((profiles ?? []) as { id: string; username: string | null; display_name: string | null }[])
    .filter((p) => p.id !== args.userId && !blocked.has(p.id) && !participants.has(p.id))
    .map((p) => ({
      userId: p.id,
      username: p.username,
      displayName: p.display_name,
      label: p.display_name?.trim() || (p.username ? `@${p.username}` : 'A member'),
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Re-check a posted contact id against the same list the picker was built from.
 *
 * THE FORM VALUE IS UNTRUSTED. A hand-rolled POST can name any uuid, and without
 * this an owner could mint an invite addressed to a stranger — or to somebody who
 * blocked him — and have it delivered straight to their notifications. Recomputing
 * the list is a few cheap indexed reads and means the picker and the guard can
 * never disagree about who is eligible.
 */
export async function isInvitableContact(
  client: Queryable,
  args: { userId: string; goalId: string; contactUserId: string },
): Promise<boolean> {
  if (!args.contactUserId || args.contactUserId === args.userId) return false
  const contacts = await listGoalContacts(client, args)
  return contacts.some((c) => c.userId === args.contactUserId)
}
