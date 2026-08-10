'use server'

// Mutations for the notes feed — one module for both spines.
//
// These use the SESSION client, so RLS is the gate rather than a hand-written
// ownership filter I could forget. A feed the caller can't write to matches the
// insert policy zero times and the write simply fails; there is no second
// permission check here to drift out of step with migration 145.
//
// WHY THESE RETURN STATE INSTEAD OF void: the rest of the goals surface uses
// `Promise<void>` form actions and treats the revalidated page as the feedback
// (see app/(tools)/goals/actions.ts). That works for a one-tap "mark it done".
// It does not work here — a rejected note has to tell you WHY, and the thing it
// rejected is a paragraph you just typed and would otherwise lose. So these
// return a state object for useActionState. Server actions still submit without
// client JavaScript, so the no-JS path survives.
//
// ⚠️ EVERY EXPORT FROM THIS FILE MUST BE AN ASYNC FUNCTION — that is the "use
//    server" contract, and a stray `export const` or `export type` here is a build
//    error, not a lint nit. The shared state type, the idle value and the length
//    cap therefore live in lib/goals/note-types.ts, which is neither
//    `server-only` nor `use server` precisely so both sides can import it.

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'

import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizePlainText } from '@/lib/sanitize'
import { notifyNewNote } from '@/lib/goals/note-notify'
import { reportContent } from '@/lib/messaging'
import { listNotes, markNotesRead } from '@/lib/goals/notes'
import {
  isNoteSubjectType,
  MAX_NOTE_LENGTH,
  NOTE_DONE,
  noteFailed,
  type NoteActionState,
  type NoteRow,
  type NoteSubject,
  type NoteSubjectType,
} from '@/lib/goals/note-types'

/** Every surface that shows this feed, so a post lands everywhere at once. */
function pathsFor(subject: NoteSubject): string[] {
  if (subject.type === 'savings_goal') {
    return [`/tools/savings/${subject.id}`, '/tools/savings']
  }
  // The partner's view is a different route from the owner's, and both are stale
  // the moment either of them writes.
  return [`/goals/${subject.id}`, `/goals/shared/${subject.id}`, '/goals']
}

function revalidateFeed(subject: NoteSubject): void {
  for (const p of pathsFor(subject)) revalidatePath(p)
}

function readSubject(formData: FormData): NoteSubject | null {
  const type = String(formData.get('subjectType') ?? '')
  const id = String(formData.get('subjectId') ?? '')
  if (!isNoteSubjectType(type) || !id) return null
  return { type, id }
}

/**
 * Post a note.
 *
 * The guard sequence mirrors sendMessage (lib/messaging.ts) with ONE deliberate
 * omission: no pairwise connection or block check. Those are 1:1 assumptions and
 * they break here — partners on a goal are each connected to the OWNER, not to
 * each other, so requiring mutual connection would make a three-person feed
 * unwritable. The equivalent protections live where they belong instead: blocks
 * are folded into goal_note_access (so a block hides the feed outright), and
 * ending a connection already deletes the goal_participants row via migration
 * 140's cascade, which revokes access with no extra check.
 */
export async function postNote(
  _prev: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const subject = readSubject(formData)
  const raw = String(formData.get('body') ?? '')
  if (!subject) return noteFailed('Something went wrong. Reload and try again.', raw)

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return noteFailed('Sign in to write here.', raw)

  // Flood backstop, sharing the message bucket (30/min). RLS is the real gate;
  // this only throttles scripts.
  const { success } = await checkRateLimit(`note:${user.id}`, 'message')
  if (!success) {
    return noteFailed("You're writing faster than we can keep up — take a breath.", raw)
  }

  // Strip markup on write, same as DMs. The feed renders escaped text today; this
  // keeps stored markup out if the render path ever changes.
  const body = sanitizePlainText(raw).trim()
  if (!body) return NOTE_DONE
  if (body.length > MAX_NOTE_LENGTH) {
    return noteFailed(`That's longer than ${MAX_NOTE_LENGTH} characters.`, raw)
  }

  const { data: created, error } = await supabase
    .from('goal_notes')
    .insert({
      subject_type: subject.type,
      subject_id: subject.id,
      author_id: user.id,
      body,
    })
    .select('id')
    .single()

  if (error || !created) {
    // 42501 / RLS refusal — he lost access between loading the page and posting,
    // which is what a revoke or a block looks like from here.
    console.error('goal notes: post failed —', error?.message)
    return noteFailed('Could not post that. You may no longer have access here.', raw)
  }

  // Writing is reading. Without this the author's own note counts against him the
  // next time the badge is computed.
  await markNotesRead(supabase, subject, user.id)

  // AFTER the write, and NOT awaited on the request path. Notifying fans out to
  // every recipient — an in-app insert and a web-push round trip each — and making
  // the author stare at a spinner while his wife's push service is slow is a real
  // cost for zero benefit to him. The note is already committed; nothing below
  // changes what he sees. `after()` lets the response go out and the work finish
  // on the same invocation, which is what keeps it reliable on serverless where a
  // bare floating promise can be killed at response time.
  after(() => notifyNewNote({ subject, authorId: user.id, noteId: created.id }))

  revalidateFeed(subject)
  return NOTE_DONE
}

/**
 * Edit your own note.
 *
 * Only the body can change — migration 145's trigger freezes the parent, the
 * author and the timestamp, so there is nothing else to guard against here.
 * `edited_at` is stamped by that same trigger rather than sent from here, which is
 * what makes the "edited" marker mean something on a surface where partners are
 * reading each other.
 */
export async function editNote(
  _prev: NoteActionState,
  formData: FormData,
): Promise<NoteActionState> {
  const subject = readSubject(formData)
  const noteId = String(formData.get('noteId') ?? '')
  const raw = String(formData.get('body') ?? '')
  if (!subject || !noteId) return noteFailed('Something went wrong. Reload and try again.', raw)

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return noteFailed('Sign in first.', raw)

  const body = sanitizePlainText(raw).trim()
  if (!body) return noteFailed('A note cannot be empty. Delete it instead.', raw)
  if (body.length > MAX_NOTE_LENGTH) {
    return noteFailed(`That's longer than ${MAX_NOTE_LENGTH} characters.`, raw)
  }

  // No author filter: the update policy is `author_id = auth.uid()`, so someone
  // else's note matches zero rows. Adding `.eq('author_id', …)` here would be a
  // second copy of that rule, free to drift.
  const { error } = await supabase.from('goal_notes').update({ body }).eq('id', noteId)
  if (error) {
    console.error('goal notes: edit failed —', error.message)
    return noteFailed('Could not save that change.', raw)
  }

  // Deliberately silent. An edit is not a new thing said, and pushing "Kim wrote
  // on your goal" for a fixed typo trains people to ignore the real ones.
  revalidateFeed(subject)
  return NOTE_DONE
}

/**
 * Delete a note.
 *
 * RLS carries two DELETE policies — the author's, and the subject owner's, who
 * moderates his own feed. Like removeParticipant, this is one function for both:
 * whichever the caller is, the delete removes exactly the row they're entitled to
 * and a caller who is neither removes nothing.
 */
export async function deleteNote(formData: FormData): Promise<void> {
  const subject = readSubject(formData)
  const noteId = String(formData.get('noteId') ?? '')
  if (!subject || !noteId) return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  const { error } = await supabase.from('goal_notes').delete().eq('id', noteId)
  if (error) console.error('goal notes: delete failed —', error.message)

  revalidateFeed(subject)
}

/**
 * Report a note.
 *
 * Separate from deleting it, and available to people who cannot delete it. The
 * owner can already remove anything said in his feed, but removal is silent and
 * leaves no record — the person who most needs an escalation route is the one
 * being spoken to, and on a goal about someone's recovery that matters.
 *
 * Reports go to `abuse_reports` (083), which only admins can read. Nothing is
 * revealed to the author: no notification, no visible state on the note. A report
 * that tips off the person you reported is worse than no report.
 */
export async function reportNote(formData: FormData): Promise<void> {
  const noteId = String(formData.get('noteId') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!noteId || !reason) return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  // The author is attached server-side. Taking it from the form would let a
  // caller name anyone they liked as the reported party.
  const { data: note } = await supabase
    .from('goal_notes')
    .select('author_id')
    .eq('id', noteId)
    .maybeSingle()
  if (!note) return

  await reportContent({
    goalNoteId: noteId,
    reportedUserId: note.author_id,
    reason,
  })
}

/**
 * Fetch the page of notes older than `before`.
 *
 * The feed loads from the recent end, which is where a conversation lives, but a
 * journal is exactly the thing people scroll back through — a cap with no way
 * past it would quietly bury a year of someone's own writing.
 *
 * Keyset, not offset: `before` is the createdAt of the oldest note already held.
 * An offset would skip or repeat rows as new notes arrive at the other end.
 */
export async function loadOlderNotes(
  type: NoteSubjectType,
  id: string,
  before: string,
): Promise<{ notes: NoteRow[]; hasMore: boolean }> {
  if (!isNoteSubjectType(type) || !id || !before) return { notes: [], hasMore: false }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { notes: [], hasMore: false }

  // RLS scopes this exactly as it scopes the first page — no extra check here.
  return listNotes(supabase, { type, id }, user.id, { before })
}

/**
 * Mark the feed read.
 *
 * ⚠️ THIS EXISTS SO THE PAGE DOESN'T DO IT DURING RENDER. Next prefetches RSC
 *    payloads on link hover and viewport entry; a mark-read at render time would
 *    clear the badge for a feed nobody opened — hovering a card on /goals would be
 *    enough to zero it. The client component calls this once the feed is actually
 *    on screen.
 *
 * No revalidate: the badge the caller is looking at is already correct, and
 * re-rendering the page underneath someone who just opened it is worse than a
 * count that updates on next navigation.
 */
export async function markFeedRead(type: NoteSubjectType, id: string): Promise<void> {
  if (!isNoteSubjectType(type) || !id) return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  await markNotesRead(supabase, { type, id }, user.id)
}
