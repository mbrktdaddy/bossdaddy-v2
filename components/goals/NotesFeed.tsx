// The notes feed — a private journal that becomes a conversation.
//
// ONE COMPONENT FOR BOTH SPINES AND BOTH FACES. The goals spine (134) and savings
// (078) render the identical surface, and the surface itself changes character
// with its audience rather than with a prop:
//
//   SOLO      nobody else can read it. Journal framing, journal placeholder, and
//             the standing warning that granting access later exposes all of it.
//   SHARED    author names and avatars appear, and it reads as a conversation.
//
// `shared` is derived from whether anyone else can actually READ the feed — not
// from whether the goal has partners. A goal with three cheer partners who all
// hold thread_access='none' is still a private journal, and dressing it up as a
// conversation would imply an audience that isn't there.
//
// This is the server half: it fetches, decides which face to show, and hands a
// plain payload to the client half. Everything interactive — realtime, the
// composer, mark-read — lives in NotesFeedClient.

import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { getNoteAccess, listNotes } from '@/lib/goals/notes'
import type { NoteSubject } from '@/lib/goals/note-types'
import NotesFeedClient from './NotesFeedClient'

type Props = {
  subject: NoteSubject
  /**
   * How many OTHER people can read this feed. Drives journal-vs-conversation
   * framing. The caller already knows its participant roster, so it passes the
   * number rather than making this component re-derive it per spine.
   */
  readerCount: number
  /**
   * The viewer owns this goal. Passed in rather than re-queried: every caller
   * already knows, and the two spines answer it from different columns.
   */
  isSubjectOwner: boolean
}

export default async function NotesFeed({ subject, readerCount, isSubjectOwner }: Props) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  const { access, failed } = await getNoteAccess(supabase, subject)

  // A LOOKUP FAILURE IS NOT "NO ACCESS", and saying so on a man's own journal is
  // the difference between "something broke" and "your notes are gone".
  if (failed) {
    return (
      <section className="bg-surface border border-soft rounded-xl p-6">
        <p className="text-sm text-prose-faint">{LABELS.goals.notesLoadFailed}</p>
      </section>
    )
  }

  if (access === 'none') return null

  const { notes, hasMore } = await listNotes(supabase, subject, user.id)

  return (
    <NotesFeedClient
      subject={subject}
      access={access}
      initialNotes={notes}
      hasMore={hasMore}
      viewerId={user.id}
      shared={readerCount > 0}
      isSubjectOwner={isSubjectOwner}
    />
  )
}
