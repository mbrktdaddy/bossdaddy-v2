// Telling people a note was posted.
//
// ⚠️ READ THIS BEFORE "RESTORING" MIGRATION 137 RULE 1.
//
// 137 says NO PARTICIPANT EVER GETS A NOTIFICATION, and that rule is intact for
// what it was written about: the SWEEP reporting on BEHAVIOUR. A push telling a
// man's wife he missed his meds is the snitch product, and the sweep's recipient
// lookup is still owner-only — nothing in this file touches it.
//
// A person choosing to type a sentence to you is the opposite act. It is authored
// by a human, both sides opted into it, and it carries no logged data. Silence
// there is not privacy, it is a dead feed nobody returns to.
//
//   THE LINE IS: THE SYSTEM NEVER REPORTS ON YOU; PEOPLE MAY SPEAK TO YOU.
//
// Three rules keep this on the right side of that line, and all three are load-
// bearing rather than polish:
//
// 1. THE BODY NEVER LEAVES THE AUTH WALL. Not in the push, not in the in-app row.
//    A lock-screen preview is readable by whoever is holding the phone, and on a
//    cessation or medication goal the note is the most intimate text in the
//    product. Recipients get WHO and WHERE; the words need a login.
//
// 2. A SENSITIVE GOAL IS NEVER NAMED. "Kim wrote on Quit smoking" on a lock screen
//    discloses the goal itself to anyone glancing at it — the exact thing the
//    tiers exist to control. Sensitive goals fall back to a neutral phrase.
//
// 3. BLOCKS ARE HONOURED, and that is enforced in noteAudience() rather than here.
//    See the warning on that function: the stored thread_access column does not
//    know about blocks, so it has to be filtered by hand.
//
// ⚠️ ONE PING PER UNREAD RUN, NOT ONE PER NOTE. Migration 085 deleted this exact
//    mistake for DMs — "Retire existing in-app message pings. They duplicated
//    message-unread" — and the convention it settled is that a conversation owns
//    its own unread state and the notification feed carries non-message activity.
//    goal_note_reads.last_read_at owns unread here, and the goal card already
//    renders "10 new"; a row per note would put ten lines in the bell saying what
//    one badge says. So a recipient who ALREADY has something unread in this feed
//    gets nothing new — they have been told. The ping resumes once they read.
//
// Best-effort throughout. A failed notification must never fail the post — the
// note is already saved, and throwing here would show the author an error for
// something that worked.

import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { createNotification } from '@/lib/notifications'
import { sendPushToUser } from '@/lib/push'
import { noteAudience, type NoteSubject } from '@/lib/goals/notes'

/**
 * Where a given recipient reads this feed. The owner and a partner do not share a
 * URL on the goals spine, and linking a partner at /goals/[id] would drop them on
 * a page RLS refuses.
 */
export function noteFeedPath(subject: NoteSubject, isOwner: boolean): string {
  if (subject.type === 'savings_goal') return `/tools/savings/${subject.id}`
  return isOwner ? `/goals/${subject.id}` : `/goals/shared/${subject.id}`
}

type SubjectLabel = { title: string; sensitive: boolean }

/**
 * The goal's title, and whether naming it is safe.
 *
 * `sensitive` comes from goals.config, set from the template at create time
 * (migration 136). Savings goals are never flagged sensitive — a shared pot for a
 * kid's bike is not a medication log — so they are always safe to name.
 */
async function subjectLabel(
  admin: ReturnType<typeof createAdminClient>,
  subject: NoteSubject,
): Promise<SubjectLabel> {
  if (subject.type === 'savings_goal') {
    const { data } = await admin
      .from('savings_goals')
      .select('name')
      .eq('id', subject.id)
      .maybeSingle()
    return { title: data?.name ?? 'a savings goal', sensitive: false }
  }

  const { data } = await admin
    .from('goals')
    .select('title, config')
    .eq('id', subject.id)
    .maybeSingle()
  const config = data?.config as { sensitive?: unknown } | null
  return {
    title: data?.title ?? 'a goal',
    sensitive: config?.sensitive === true,
  }
}

/**
 * Which recipients already had something unread in this feed BEFORE the note that
 * just landed. Those people have already been pinged and are not pinged again.
 *
 * Two bounded reads rather than a count per recipient. The recent-notes window is
 * enough to answer the only question being asked — "is there at least one unread"
 * — because a recipient far enough behind to fall outside the window is, by
 * definition, behind.
 */
async function alreadyPinged(
  admin: ReturnType<typeof createAdminClient>,
  subject: NoteSubject,
  userIds: string[],
  newNoteId: string | null,
): Promise<Set<string>> {
  const backlogged = new Set<string>()
  if (userIds.length === 0) return backlogged

  const [{ data: reads }, { data: recent }] = await Promise.all([
    admin
      .from('goal_note_reads')
      .select('user_id, last_read_at')
      .eq('subject_type', subject.type)
      .eq('subject_id', subject.id)
      .in('user_id', userIds),
    admin
      .from('goal_notes')
      .select('id, created_at, author_id')
      .eq('subject_type', subject.type)
      .eq('subject_id', subject.id)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  const lastRead = new Map((reads ?? []).map((r) => [r.user_id, r.last_read_at]))
  // The note that triggered this is the thing we're announcing — it must not count
  // as its own backlog.
  const prior = (recent ?? []).filter((n) => n.id !== newNoteId)

  for (const uid of userIds) {
    const since = lastRead.get(uid)
    const has = prior.some((n) =>
      n.author_id !== uid && (!since || new Date(n.created_at) > new Date(since)))
    if (has) backlogged.add(uid)
  }
  return backlogged
}

/**
 * Announce a new note to everyone else in the feed.
 *
 * Fire-and-forget from the caller's point of view: this never throws and never
 * reports failure upward, because by the time it runs the note is committed and
 * there is nothing useful the author could do about a push that didn't land.
 */
export async function notifyNewNote(args: {
  subject: NoteSubject
  authorId: string
  /** The note just written. Excluded from the backlog check — see alreadyPinged. */
  noteId?: string | null
}): Promise<void> {
  try {
    const admin = createAdminClient()

    const [recipients, label, { data: author }] = await Promise.all([
      noteAudience(admin, args.subject, args.authorId),
      subjectLabel(admin, args.subject),
      admin.from('profiles').select('username, display_name').eq('id', args.authorId).maybeSingle(),
    ])

    if (recipients.length === 0) return

    const pinged = await alreadyPinged(
      admin,
      args.subject,
      recipients.map((r) => r.userId),
      args.noteId ?? null,
    )
    const fresh = recipients.filter((r) => !pinged.has(r.userId))
    if (fresh.length === 0) return

    const who = author?.display_name?.trim() || author?.username || 'Someone'

    // Rule 2. On a sensitive goal the title is itself the disclosure.
    const where = label.sensitive ? 'one of your goals' : `“${label.title}”`
    const title = `${who} wrote on ${where}`

    await Promise.all(
      fresh.map(async (r) => {
        const link = noteFeedPath(args.subject, r.isOwner)

        // Rule 1: `body` is deliberately omitted from BOTH channels. The row
        // carries who and where; the words stay behind the login.
        await createNotification({
          userId: r.userId,
          type: 'goal_note',
          title,
          link,
          payload: { subjectType: args.subject.type, subjectId: args.subject.id },
        })

        // A muted savings participant (migration 104) keeps the in-app row and
        // loses the push — "stop pinging me about this goal" is a fair reading of
        // that flag, and the feed still carries the note when they next look.
        if (r.push) {
          await sendPushToUser(r.userId, {
            title,
            url: link,
            // One tag per feed, so ten notes in a conversation collapse into one
            // notification instead of ten. Matches the `dm:` convention.
            tag: `note:${args.subject.type}:${args.subject.id}`,
          })
        }
      }),
    )
  } catch (err) {
    console.error('goal notes: notify failed —', err)
  }
}
