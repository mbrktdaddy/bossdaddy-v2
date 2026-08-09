// Connections — the consent gate between two members.
//
// Migration 140's header carries the doctrine; this file is the app-side surface
// and enforces the parts SQL can't reach. Three things to hold onto:
//
//   • WRITES GO THROUGH THE RPCs. `user_connections` has no INSERT and no UPDATE
//     policy. request_connection() and respond_to_connection() are security
//     definer because ordering, self-refusal, blocks, the decline cooldown and the
//     simultaneous-request merge have to hold together as one decision. Don't
//     reach for .from('user_connections').insert() — RLS will refuse it, and it
//     would be wrong even if it didn't.
//   • A DECLINE IS SILENT. Nothing here notifies a requester that they were turned
//     down, and connection_state_with() deliberately reports a declined request
//     back to them as still pending until the cooldown lapses.
//   • AN ACCEPT DOES NOTIFY. That one is wanted — it's the "you're in" that makes
//     the request worth sending.
//
// Reads use the CALLER'S client so RLS scopes them to their own relationships.
// Never pass the admin client: "who is X connected to" must stay unanswerable.

import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

type Client = SupabaseClient<Database>

export type ConnectionState =
  | 'none' | 'pending_in' | 'pending_out' | 'accepted' | 'declined' | 'blocked'

export type ConnectionPerson = {
  userId: string
  username: string | null
  displayName: string | null
  /** What to render. Display name, else @username, else a neutral fallback. */
  label: string
}

export type ConnectionRow = ConnectionPerson & {
  status: 'pending' | 'accepted' | 'declined'
  /** True when THEY asked YOU — i.e. it's waiting on you. */
  incoming: boolean
  since: string
}

/**
 * What to render for this pair, in one round trip.
 *
 * Delegates to the SQL function rather than reconstructing the logic here: the
 * block precedence and the silent-decline masking are security decisions, and
 * having them in two places is how they drift apart.
 */
export async function connectionStateWith(
  client: Client,
  otherUserId: string,
): Promise<ConnectionState> {
  const { data, error } = await client.rpc('connection_state_with', { _other: otherUserId })
  if (error) {
    console.error('connections: state read failed —', error.message)
    return 'none'
  }
  return (data as ConnectionState) ?? 'none'
}

/**
 * Batch form for lists — one round trip for N people.
 *
 * ⚠️ THIS MUST GO THROUGH THE RPC. It used to rebuild the logic in TypeScript over
 * the caller's client, and that could only ever see half the blocks: RLS on
 * user_blocks is `using (blocker_id = auth.uid())`, so you read the blocks you
 * created and none of the ones aimed at you. The result was that blocking someone
 * removed them from your search and left you fully visible in theirs. The SQL
 * function is security definer and sees both directions — see migration 143.
 *
 * Any id the function doesn't answer for falls back to 'none', so a caller can map
 * straight over its own list without checking for gaps.
 */
export async function connectionStatesFor(
  client: Client,
  _userId: string,
  otherIds: string[],
): Promise<Map<string, ConnectionState>> {
  const out = new Map<string, ConnectionState>()
  if (otherIds.length === 0) return out

  const { data, error } = await client.rpc('connection_states_for', { _others: otherIds })
  if (error) {
    // Fail CLOSED on the only thing that matters here. We can't tell blocked from
    // not-blocked, and rendering a Connect button at someone who blocked you is
    // the one outcome worth avoiding, so report nothing as actionable.
    console.error('connections: batch state read failed —', error.message)
    for (const id of otherIds) out.set(id, 'blocked')
    return out
  }

  for (const row of (data ?? []) as { other_id: string; state: string }[]) {
    out.set(row.other_id, row.state as ConnectionState)
  }
  for (const id of otherIds) if (!out.has(id)) out.set(id, 'none')
  return out
}

// ── lists ───────────────────────────────────────────────────────────────────

async function hydrate(
  client: Client,
  rows: { user_a: string; user_b: string; requester_id: string; status: string;
          accepted_at: string | null; created_at: string }[],
  userId: string,
): Promise<ConnectionRow[]> {
  const otherIds = rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a))
  if (otherIds.length === 0) return []

  const { data: profiles } = await client
    .from('profiles').select('id, username, display_name').in('id', otherIds)
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  return rows.map((r) => {
    const otherId = r.user_a === userId ? r.user_b : r.user_a
    const p = byId.get(otherId)
    return {
      userId: otherId,
      username: p?.username ?? null,
      displayName: p?.display_name ?? null,
      label: p?.display_name?.trim() || (p?.username ? `@${p.username}` : 'A member'),
      status: r.status as ConnectionRow['status'],
      incoming: r.requester_id !== userId,
      since: r.accepted_at ?? r.created_at,
    }
  }).sort((a, b) => a.label.localeCompare(b.label))
}

const SELECT = 'user_a, user_b, requester_id, status, accepted_at, created_at'

/** Everyone you're connected to. */
export async function listConnections(client: Client, userId: string): Promise<ConnectionRow[]> {
  const { data, error } = await client
    .from('user_connections').select(SELECT)
    .eq('status', 'accepted')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  if (error) { console.error('connections: list failed —', error.message); return [] }
  return hydrate(client, data ?? [], userId)
}

/** Requests waiting on YOU. */
export async function listIncoming(client: Client, userId: string): Promise<ConnectionRow[]> {
  const { data, error } = await client
    .from('user_connections').select(SELECT)
    .eq('status', 'pending')
    .neq('requester_id', userId)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  if (error) { console.error('connections: incoming failed —', error.message); return [] }
  return hydrate(client, data ?? [], userId)
}

/**
 * Requests YOU sent that haven't been answered.
 *
 * Declined rows inside their cooldown are INCLUDED and presented as pending —
 * the same masking connection_state_with() applies. Seeing a request vanish from
 * this list the moment it was refused would tell the requester exactly what the
 * silence is there to withhold.
 *
 * WHICH ROWS STILL COUNT AS PENDING IS ASKED OF THE DATABASE, not recomputed
 * here. This used to carry its own copy of the 30-day cooldown arithmetic, which
 * is the same shape of duplication that made blocking half-work until migration
 * 143 — one of the two copies is always the one nobody updates. `pending_out` is
 * exactly "still waiting on them", masking included, so the RPC answers it.
 */
export async function listOutgoing(client: Client, userId: string): Promise<ConnectionRow[]> {
  const { data, error } = await client
    .from('user_connections')
    .select(SELECT)
    .in('status', ['pending', 'declined'])
    .eq('requester_id', userId)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
  if (error) { console.error('connections: outgoing failed —', error.message); return [] }

  const rows = data ?? []
  if (rows.length === 0) return []

  const states = await connectionStatesFor(
    client, userId,
    rows.map((r) => (r.user_a === userId ? r.user_b : r.user_a)),
  )
  const stillShowing = rows.filter((r) => {
    const other = r.user_a === userId ? r.user_b : r.user_a
    return states.get(other) === 'pending_out'
  })

  return (await hydrate(client, stillShowing, userId))
    .map((r) => ({ ...r, status: 'pending' as const }))
}

/** People you've blocked. The list that didn't exist before this feature. */
export async function listBlocked(client: Client, userId: string): Promise<ConnectionPerson[]> {
  const { data } = await client
    .from('user_blocks').select('blocked_id').eq('blocker_id', userId)
  const ids = (data ?? []).map((r) => r.blocked_id)
  if (ids.length === 0) return []

  const { data: profiles } = await client
    .from('profiles').select('id, username, display_name').in('id', ids)
  return (profiles ?? []).map((p) => ({
    userId: p.id,
    username: p.username,
    displayName: p.display_name,
    label: p.display_name?.trim() || (p.username ? `@${p.username}` : 'A member'),
  })).sort((a, b) => a.label.localeCompare(b.label))
}

// ── writes ──────────────────────────────────────────────────────────────────

/** Every refusal the RPC can raise, in words a person can act on. */
const REASONS: Record<string, string> = {
  'cannot connect with yourself': 'That\'s you.',
  'user not found':               'Couldn\'t find them.',
  // Deliberately identical for blocks and a closed inbox: distinguishing them
  // tells the sender something about the other person they aren't owed.
  'blocked':                      'You can\'t connect with them.',
  'not accepting requests':       'You can\'t connect with them.',
  'cooldown':                     'You\'ve already asked. Give it some time.',
}

function reasonFor(message: string): string {
  for (const [needle, copy] of Object.entries(REASONS)) {
    if (message.includes(needle)) return copy
  }
  return 'Couldn\'t send that request.'
}

export async function requestConnection(
  client: Client,
  args: { myUserId: string; otherUserId: string; myName: string },
): Promise<{ ok: true; state: 'pending' | 'accepted' } | { ok: false; error: string }> {
  const { data, error } = await client.rpc('request_connection', { _other: args.otherUserId })
  if (error) return { ok: false, error: reasonFor(error.message ?? '') }

  const state = data as 'pending' | 'accepted'

  // Notify the addressee that someone's asking. Actionable, so the notification
  // itself carries accept/decline — see /api/notifications/[id]/action.
  //
  // On 'accepted' the RPC merged two crossing requests, which means the other
  // person had already asked: they get the good news, not another ask.
  const { createNotification } = await import('@/lib/notifications')
  await createNotification({
    userId: args.otherUserId,
    type: state === 'accepted' ? 'connection_accepted' : 'connection_request',
    title: state === 'accepted'
      ? `You and ${args.myName} are connected`
      : `${args.myName} wants to connect`,
    body: state === 'accepted'
      ? 'You both asked, so that settles it. You can message each other now.'
      : 'Connect to message each other and share goals.',
    link: '/account/connections',
    // WHO ASKED — not who's being notified. The accept/decline buttons on the
    // notification need to name the other party back to respond_to_connection,
    // and that is the sender, i.e. us.
    payload: { requester_id: args.myUserId },
    actionRequired: state !== 'accepted',
  })

  return { ok: true, state }
}

export async function respondToConnection(
  client: Client,
  args: { otherUserId: string; accept: boolean; myName: string },
): Promise<{ ok: true; state: 'accepted' | 'declined' } | { ok: false; error: string }> {
  const { data, error } = await client.rpc('respond_to_connection', {
    _other: args.otherUserId, _accept: args.accept,
  })
  if (error) {
    console.error('connections: respond failed —', error.message)
    return { ok: false, error: 'Couldn\'t answer that request.' }
  }

  const state = data as 'accepted' | 'declined'

  // ACCEPTS NOTIFY, DECLINES DO NOT. Migration 140 rule 4 — the whole reason the
  // masking in maskState() exists. Do not add an else branch here.
  if (state === 'accepted') {
    const { createNotification } = await import('@/lib/notifications')
    await createNotification({
      userId: args.otherUserId,
      type: 'connection_accepted',
      title: `${args.myName} accepted`,
      body: 'You can message each other now.',
      link: '/account/connections',
    })
  }

  return { ok: true, state }
}

/**
 * Withdraw a request you sent, or end a connection. One function: RLS carries a
 * withdraw policy and a remove policy, so whichever the caller is, the delete
 * removes exactly the row they're entitled to.
 *
 * Silent both ways, and it CASCADES — migration 140's trigger drops any goal
 * participation between the two. That's the point: the connection was the
 * consent.
 */
export async function removeConnection(
  client: Client,
  args: { userId: string; otherUserId: string },
): Promise<{ ok: boolean }> {
  const [a, b] = [args.userId, args.otherUserId].sort()
  const { error } = await client
    .from('user_connections').delete().eq('user_a', a).eq('user_b', b)
  if (error) console.error('connections: remove failed —', error.message)
  return { ok: !error }
}

/**
 * Block, which is the hardest form of ending it.
 *
 * Only writes `user_blocks`; migration 140's trigger deletes the connection,
 * which cascades to goal participation. Reachable WITHOUT an existing DM thread,
 * which is new — before this, blocking lived in a thread's ⋮ menu, so you could
 * only block someone you'd already talked to.
 */
export async function blockAndDisconnect(
  client: Client,
  args: { userId: string; otherUserId: string },
): Promise<{ ok: boolean }> {
  const { error } = await client
    .from('user_blocks')
    .upsert({ blocker_id: args.userId, blocked_id: args.otherUserId })
  if (error) console.error('connections: block failed —', error.message)
  return { ok: !error }
}

export async function unblock(
  client: Client,
  args: { userId: string; otherUserId: string },
): Promise<{ ok: boolean }> {
  const { error } = await client
    .from('user_blocks').delete()
    .eq('blocker_id', args.userId).eq('blocked_id', args.otherUserId)
  return { ok: !error }
}
