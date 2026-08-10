// Notes on a goal — the read layer for migration 145.
//
// ONE MODULE FOR BOTH SPINES. A note on a goals-spine goal (134) and a note on a
// savings goal (078) are the same row in the same table, discriminated by
// `subject_type`. The two domains disagree about almost everything else —
// participants, tiers, what a "target" is — but a feed is a feed, and forking it
// would mean writing every query, action and component twice to get identical
// behaviour that then drifts.
//
// THE FEED CHANGES CHARACTER WITH ITS AUDIENCE, NOT WITH ITS SCHEMA. Solo, it is
// a private journal. Once a partner holds thread_access, the same rows are a
// conversation. Nothing here branches on that — `access` and the participant
// count are what the UI reads to decide which face to show.
//
// ACCESS IS NEVER RE-DERIVED IN THIS FILE. Every READ path defers to the
// `goal_note_access` RPC, which is also what RLS calls. Two implementations of
// "can he see this" is one implementation and one bug: if a helper here ever
// disagrees with the policy, the disagreement shows up as a feed that renders
// empty or a composer that 403s on submit, and nobody looks at the SQL.
//
// ⚠️ noteAudience() IS THE ONE PLACE THAT CANNOT USE THE RPC, because it asks
//    about OTHER people rather than the caller. It therefore has to re-derive the
//    block rule by hand — see the warning on that function.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type {
  NoteAccess,
  NoteRow,
  NoteSubject,
  NoteSubjectType,
} from '@/lib/goals/note-types'

type Client = SupabaseClient<Database>

export type { NoteAccess, NoteRow, NoteSubject, NoteSubjectType }

/**
 * How many notes one page of the feed holds. A conversation is read from the
 * recent end, so this is a WINDOW, not a ceiling — `hasMore` tells the UI there
 * is history behind it. Loading a year of a daily journal in one payload would
 * make the goal page progressively slower the more someone used it.
 */
const PAGE_SIZE = 100

/**
 * The caller's access to a feed, plus whether the lookup itself failed.
 *
 * THE TWO ARE SEPARATE ON PURPOSE. Collapsing a transient error into 'none' would
 * render a man's own private journal as an empty page with no composer — which
 * reads as "your notes are gone" or "your access was revoked", on the surface
 * where those are the two most alarming things it could say. `failed` lets the
 * page say "couldn't load this" instead of lying quietly.
 */
export type NoteAccessResult = { access: NoteAccess; failed: boolean }

/**
 * The caller's access to a feed.
 *
 * Returns 'none' for a subject that doesn't exist, that they can't reach, or when
 * a block sits between them and the owner — the RPC folds all three into the same
 * answer on purpose, so a probe can't distinguish "no such goal" from "not for
 * you".
 */
export async function getNoteAccess(client: Client, subject: NoteSubject): Promise<NoteAccessResult> {
  const { data, error } = await client.rpc('goal_note_access', {
    _subject_type: subject.type,
    _subject_id: subject.id,
  })
  if (error) {
    console.error('goal notes: access check failed —', error.message)
    return { access: 'none', failed: true }
  }
  return { access: (data as NoteAccess | null) ?? 'none', failed: false }
}

export type NotePage = {
  /** Oldest first — reading order. */
  notes: NoteRow[]
  /** There is history behind the window. The UI owes the reader a way back. */
  hasMore: boolean
}

/**
 * One page of the feed, oldest first — reading order for a conversation.
 *
 * Fetched newest-first so the window keeps the RECENT end when a goal has run
 * long, then reversed. Ordering ascending in the query and limiting would
 * silently serve the oldest hundred notes and drop everything anyone is actually
 * talking about.
 *
 * `before` walks backwards through history: pass the createdAt of the oldest note
 * you already hold. Keyset, not offset — an offset would skip or repeat rows as
 * new notes arrive at the other end of a live conversation.
 *
 * `id` is a secondary sort key, not decoration: two notes can share a timestamp,
 * and without a tiebreak their order flips between renders and the keyset cursor
 * can step over one.
 *
 * RLS is the gate. A caller with no access gets zero rows rather than an error, so
 * there is nothing to check here beyond what the policy already did.
 */
export async function listNotes(
  client: Client,
  subject: NoteSubject,
  viewerId: string,
  opts: { before?: string } = {},
): Promise<NotePage> {
  let query = client
    .from('goal_notes')
    .select('id, body, created_at, edited_at, author_id, profiles(id, username, display_name, avatar_url)')
    .eq('subject_type', subject.type)
    .eq('subject_id', subject.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    // One extra row is the cheapest possible "is there more?" — no second count
    // query, and no lying to the reader about having reached the beginning.
    .limit(PAGE_SIZE + 1)

  if (opts.before) query = query.lt('created_at', opts.before)

  const { data, error } = await query

  if (error) {
    console.error('goal notes: list failed —', error.message)
    return { notes: [], hasMore: false }
  }

  const raw = data ?? []
  const hasMore = raw.length > PAGE_SIZE
  const page = hasMore ? raw.slice(0, PAGE_SIZE) : raw

  const notes = page.map((r) => {
    const p = r.profiles as {
      id?: string | null
      username?: string | null
      display_name?: string | null
      avatar_url?: string | null
    } | null
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      editedAt: r.edited_at,
      author: {
        id: r.author_id,
        username: p?.username ?? null,
        displayName: p?.display_name ?? null,
        avatarUrl: p?.avatar_url ?? null,
      },
      mine: r.author_id === viewerId,
    }
  })

  return { notes: notes.reverse(), hasMore }
}

/**
 * How many notes are in a feed. Feeds the share page's grant warning.
 *
 * COUNTS EVERY AUTHOR'S NOTES, NOT JUST THE OWNER'S, and the warning copy is
 * worded to match ("all N notes in this feed"). Granting access exposes the whole
 * feed — including what previous partners wrote — so counting only the owner's
 * would understate what he is handing over on an already-shared goal.
 */
export async function countNotes(client: Client, subject: NoteSubject): Promise<number> {
  const { count, error } = await client
    .from('goal_notes')
    .select('id', { count: 'exact', head: true })
    .eq('subject_type', subject.type)
    .eq('subject_id', subject.id)
  if (error) {
    console.error('goal notes: count failed —', error.message)
    return 0
  }
  return count ?? 0
}

/**
 * Unread counts for a whole list page in ONE call.
 *
 * /goals and /tools/savings render a card per goal. Asking per card is a round
 * trip per goal; the RPC does the aggregate server-side and applies the same
 * access check, so a badge can never advertise notes the viewer can't open.
 *
 * Subjects the caller can't read are simply absent from the map — callers should
 * treat a missing key as zero rather than as an error.
 */
export async function unreadNoteCounts(
  client: Client,
  type: NoteSubjectType,
  subjectIds: string[],
): Promise<Map<string, number>> {
  if (subjectIds.length === 0) return new Map()

  const { data, error } = await client.rpc('unread_note_counts', {
    _subject_type: type,
    _subject_ids: subjectIds,
  })
  if (error) {
    // A failed badge must not take the list page down with it.
    console.error('goal notes: unread counts failed —', error.message)
    return new Map()
  }

  const out = new Map<string, number>()
  for (const row of (data ?? []) as { subject_id: string; unread: number }[]) {
    if (row.unread > 0) out.set(row.subject_id, row.unread)
  }
  return out
}

/**
 * Mark the feed read up to now.
 *
 * ⚠️ NEVER CALL THIS DURING A SERVER COMPONENT RENDER. Next prefetches RSC
 *    payloads on link hover and on viewport entry, so a mark-read that runs at
 *    render time clears the badge for a feed nobody opened — hovering a goal card
 *    on /goals would be enough. The badge is the whole reason anyone comes back to
 *    a conversation; silently zeroing it breaks the feature in a way that looks
 *    like "notifications don't work". Call it from the server action
 *    (markFeedRead) that the client component fires once the feed is on screen.
 *
 * Upsert on the composite PK, so opening a feed twice is idempotent. Failures are
 * swallowed deliberately: a stale badge is cosmetic, and throwing would take down
 * an interaction that otherwise succeeded.
 *
 * Read markers are visible only to the person they belong to (migration 145 §4) —
 * there is no "seen at 11:42pm" for a partner to read into.
 */
export async function markNotesRead(
  client: Client,
  subject: NoteSubject,
  userId: string,
): Promise<void> {
  const { error } = await client
    .from('goal_note_reads')
    .upsert(
      {
        subject_type: subject.type,
        subject_id: subject.id,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      },
      { onConflict: 'subject_type,subject_id,user_id' },
    )
  if (error) console.error('goal notes: mark read failed —', error.message)
}

/**
 * Someone who should hear about a new note.
 *
 * `push` is separate from membership because a savings participant can mute a goal
 * (migration 104). See the mute note in noteAudience.
 */
export type NoteRecipient = {
  userId: string
  push: boolean
  /**
   * The owner reads the feed at /goals/[id]; a partner reads it at
   * /goals/shared/[id]. A notification that links to the wrong one lands on a
   * page that refuses them, which reads as the notification being broken.
   */
  isOwner: boolean
}

/**
 * Everyone who should be told about a new note, EXCLUDING the person who wrote it.
 *
 * Needs the ADMIN client: the notifier runs as the author, and the author cannot
 * read `goal_participants` rows on a goal he doesn't own, nor the savings roster
 * of a goal he merely contributes to. Same reason acceptInvitation takes one.
 *
 * ⚠️ THE BLOCK CHECK HERE IS HAND-ROLLED AND MUST STAY. Every other path asks
 *    goal_note_access, which folds blocks in. This one can't — it asks about other
 *    people, not the caller — so it reads the STORED thread_access column, and a
 *    block never touches that column. Without the filter below, blocking a partner
 *    still pushes him "Mike posted on Quit smoking": he taps it, lands on an empty
 *    feed, and the owner has leaked activity to the one person he cut off. Blocks
 *    are evaluated against the OWNER, matching the rule in migration 145.
 *
 * MUTE IS NOT THE SAME AS BLOCK. A muted savings participant (104) still belongs in
 * the audience and still gets the in-app row — mute was built to stop the REMINDER
 * CRONS nagging, and a person choosing to write to you is not the cron. What it
 * does suppress is the push, because "stop pinging me about this goal" is a fair
 * reading of the flag and the in-app feed still carries it.
 */
export async function noteAudience(
  admin: Client,
  subject: NoteSubject,
  excludeUserId: string,
): Promise<NoteRecipient[]> {
  const recipients = new Map<string, NoteRecipient>()
  let ownerId: string | null = null

  if (subject.type === 'goal') {
    const [{ data: goal }, { data: partners }] = await Promise.all([
      admin.from('goals').select('user_id').eq('id', subject.id).maybeSingle(),
      admin
        .from('goal_participants')
        .select('user_id, thread_access')
        .eq('goal_id', subject.id)
        .neq('thread_access', 'none'),
    ])
    ownerId = goal?.user_id ?? null
    if (ownerId) recipients.set(ownerId, { userId: ownerId, push: true, isOwner: true })
    for (const p of partners ?? []) {
      if (p.user_id === ownerId) continue
      recipients.set(p.user_id, { userId: p.user_id, push: true, isOwner: false })
    }
  } else {
    const [{ data: goal }, { data: participants }] = await Promise.all([
      admin.from('savings_goals').select('owner_id').eq('id', subject.id).maybeSingle(),
      admin.from('savings_goal_participants').select('user_id, muted').eq('goal_id', subject.id),
    ])
    ownerId = goal?.owner_id ?? null
    if (ownerId) recipients.set(ownerId, { userId: ownerId, push: true, isOwner: true })
    for (const p of participants ?? []) {
      // An owner row exists here too (078). Its mute flag wins over the default
      // set above — he muted his own goal, so honour it.
      recipients.set(p.user_id, {
        userId: p.user_id,
        push: !p.muted,
        isOwner: p.user_id === ownerId,
      })
    }
  }

  recipients.delete(excludeUserId)
  if (!ownerId || recipients.size === 0) return Array.from(recipients.values())

  // Blocks, in both directions, against the owner.
  const others = Array.from(recipients.keys()).filter((id) => id !== ownerId)
  if (others.length > 0) {
    const { data: blocks } = await admin
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${ownerId},blocked_id.in.(${others.join(',')})),` +
        `and(blocked_id.eq.${ownerId},blocker_id.in.(${others.join(',')}))`,
      )
    for (const b of blocks ?? []) {
      recipients.delete(b.blocker_id === ownerId ? b.blocked_id : b.blocker_id)
    }
  }

  return Array.from(recipients.values())
}
