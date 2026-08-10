'use client'

// The interactive half of the notes feed.
//
// THE SERVER IS THE SOURCE OF TRUTH FOR THE RECENT PAGE. `initialNotes` arrives
// already joined to profiles, and every mutation revalidates, so a successful
// post re-renders this component with the real row. That is why there is no
// optimistic local copy of the recent page: two lists of the same notes is two
// lists that can disagree, and the failure mode — a note that looks posted and
// isn't — is the worst one this surface has.
//
// Local state holds exactly two things the server can't: pages of OLDER history
// pulled on demand, and which note is being edited.
//
// REALTIME REFRESHES RATHER THAN APPENDS. A postgres_changes payload is the raw
// row: no username, no avatar. Appending it directly would render a partner's
// note as an anonymous block until the next navigation. router.refresh() re-runs
// the server component with the join intact, which costs a round trip and buys
// correctness on a multi-person feed.

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState, useTransition } from 'react'

import { createClient } from '@/lib/supabase/client'
import { LABELS } from '@/lib/labels'
import {
  deleteNote,
  editNote,
  loadOlderNotes,
  markFeedRead,
  postNote,
  reportNote,
} from '@/lib/goals/note-actions'
import {
  MAX_NOTE_LENGTH,
  NOTE_IDLE,
  type NoteAccess,
  type NoteRow,
  type NoteSubject,
} from '@/lib/goals/note-types'

type Props = {
  subject: NoteSubject
  access: NoteAccess
  initialNotes: NoteRow[]
  hasMore: boolean
  viewerId: string
  /** Someone other than the viewer can read this feed. Journal vs conversation. */
  shared: boolean
  /** The viewer owns the goal, so he may remove anything said in his feed. */
  isSubjectOwner: boolean
}

export default function NotesFeedClient({
  subject,
  access,
  initialNotes,
  hasMore,
  viewerId,
  shared,
  isSubjectOwner,
}: Props) {
  const router = useRouter()

  const [older, setOlder] = useState<NoteRow[]>([])
  const [olderExhausted, setOlderExhausted] = useState(false)
  const [loadingOlder, startLoadOlder] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)

  const [postState, postAction, posting] = useActionState(postNote, NOTE_IDLE)
  const formRef = useRef<HTMLFormElement>(null)

  // Clear the box only on success — `status`, not "no error". On failure the
  // action hands the draft back and it stays on screen; losing a paragraph to a
  // rate limit would be worse than the rate limit.
  useEffect(() => {
    if (postState.status === 'done') formRef.current?.reset()
  }, [postState])

  // MARK-READ RUNS HERE, NOT DURING RENDER. Next prefetches RSC payloads on link
  // hover and viewport entry, so a server-side mark-read would clear the badge for
  // a feed nobody opened. An effect only fires once this is actually mounted.
  useEffect(() => {
    void markFeedRead(subject.type, subject.id)
  }, [subject.type, subject.id, initialNotes.length])

  // Live updates. Filtered to this subject; RLS still applies to the payload, so a
  // non-participant's socket receives nothing.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notes:${subject.type}:${subject.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goal_notes',
          filter: `subject_id=eq.${subject.id}`,
        },
        (payload) => {
          // My own writes already came back through the action's revalidate.
          const row = (payload.new ?? payload.old) as { author_id?: string } | null
          if (row?.author_id === viewerId) return
          router.refresh()
        },
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [subject.type, subject.id, viewerId, router])

  // DERIVED, NOT RESET IN AN EFFECT. `initialNotes` changes on every revalidate,
  // and the obvious "clear the paged-in history when it does" is a setState inside
  // an effect — a cascading render, and it would also throw away history the
  // reader deliberately loaded every time anyone posts. Instead the two lists are
  // merged with the server's copy winning: a note present in both is the server's
  // row, so an edit made elsewhere can't be masked by a stale paged-in copy.
  const fromServer = new Set(initialNotes.map((n) => n.id))
  const notes = [...older.filter((n) => !fromServer.has(n.id)), ...initialNotes]

  // Until the reader pages back, the server's flag is the answer. After that, the
  // last page fetched is.
  const more = older.length > 0 ? !olderExhausted : hasMore

  const canWrite = access === 'write'

  function onLoadOlder() {
    const oldest = notes[0]
    if (!oldest) return
    startLoadOlder(async () => {
      const page = await loadOlderNotes(subject.type, subject.id, oldest.createdAt)
      setOlder((prev) => [...page.notes, ...prev])
      setOlderExhausted(!page.hasMore)
    })
  }

  const L = LABELS.goals
  const title = shared ? L.notesShared : L.notesSolo

  return (
    <section className="bg-surface border border-soft rounded-xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {title}
        </h2>
        {notes.length > 0 && (
          <span className="text-xs text-prose-faint shrink-0">
            {notes.length}
            {more ? '+' : ''}
          </span>
        )}
      </div>

      {more && (
        <button
          type="button"
          onClick={onLoadOlder}
          disabled={loadingOlder}
          className="mt-4 w-full py-3 text-xs uppercase tracking-widest font-semibold text-prose-muted border border-soft rounded-xl hover:bg-surface-hover disabled:opacity-50"
        >
          {loadingOlder ? 'Loading…' : L.notesOlderCta}
        </button>
      )}

      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-prose-faint">
          {canWrite
            ? shared ? L.notesEmptyShared : L.notesEmptySolo
            : L.notesEmptyRead}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id}>
              <NoteItem
                note={note}
                subject={subject}
                shared={shared}
                isSubjectOwner={isSubjectOwner}
                editing={editingId === note.id}
                onEdit={() => setEditingId(note.id)}
                onCancelEdit={() => setEditingId(null)}
                onEdited={() => setEditingId(null)}
              />
            </li>
          ))}
        </ol>
      )}

      {canWrite && (
        <form ref={formRef} action={postAction} className="mt-5">
          <input type="hidden" name="subjectType" value={subject.type} />
          <input type="hidden" name="subjectId" value={subject.id} />

          <label htmlFor="note-body" className="sr-only">
            {shared ? 'Write to the feed' : 'Write a note'}
          </label>
          <textarea
            id="note-body"
            name="body"
            rows={3}
            maxLength={MAX_NOTE_LENGTH}
            defaultValue={postState.draft ?? ''}
            placeholder={shared ? L.notesPlaceholderShared : L.notesPlaceholderSolo}
            className="w-full rounded-xl bg-surface-sunken border border-soft p-3 text-sm text-prose placeholder:text-prose-faint focus:border-strong focus:outline-none"
          />

          {postState.error && (
            <p className="mt-2 text-sm text-danger-ink">{postState.error}</p>
          )}

          {/*
            THE STANDING WARNING ON A SOLO FEED. Migration 145 gives a newly granted
            partner the WHOLE history, so this has to be visible while he writes —
            not buried on the share page he'll visit weeks later.
          */}
          {!shared && (
            <p className="mt-2 text-xs text-prose-faint">{L.notesPrivateHint}</p>
          )}

          <button
            type="submit"
            disabled={posting}
            className="mt-3 w-full sm:w-auto px-5 py-3 rounded-xl bg-accent hover:bg-accent-hover text-white text-sm font-semibold disabled:opacity-50"
          >
            {posting ? 'Saving…' : shared ? L.notesSaveShared : L.notesSaveSolo}
          </button>
        </form>
      )}

      {access === 'read' && (
        <p className="mt-4 text-xs text-prose-faint">{L.notesReadOnly}</p>
      )}
    </section>
  )
}

function NoteItem({
  note,
  subject,
  shared,
  isSubjectOwner,
  editing,
  onEdit,
  onCancelEdit,
  onEdited,
}: {
  note: NoteRow
  subject: NoteSubject
  shared: boolean
  isSubjectOwner: boolean
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
  onEdited: () => void
}) {
  const [editState, editAction, saving] = useActionState(editNote, NOTE_IDLE)

  // ⚠️ GUARDED ON `status === 'done'`, NOT ON "no error". Every note renders a
  //    NoteItem, and `onEdited` clears the feed's SHARED editingId. With the old
  //    inferred check, NOTE_IDLE looked identical to success, so any newly mounted
  //    NoteItem fired this on mount and closed whatever editor was open — meaning
  //    a partner posting while you were mid-edit wiped the text you were typing.
  useEffect(() => {
    if (editState.status === 'done') onEdited()
    // onEdited identity changes every render; depending on it would re-run this
    // on unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState])

  const name = note.author.displayName?.trim()
    || (note.author.username ? `@${note.author.username}` : 'A member')

  if (editing) {
    return (
      <form action={editAction} className="rounded-xl bg-surface-sunken border border-strong p-3">
        <input type="hidden" name="subjectType" value={subject.type} />
        <input type="hidden" name="subjectId" value={subject.id} />
        <input type="hidden" name="noteId" value={note.id} />
        <textarea
          name="body"
          rows={3}
          maxLength={MAX_NOTE_LENGTH}
          defaultValue={editState.draft ?? note.body}
          className="w-full rounded-lg bg-surface border border-soft p-2.5 text-sm text-prose focus:border-strong focus:outline-none"
        />
        {editState.error && <p className="mt-2 text-sm text-danger-ink">{editState.error}</p>}
        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-4 py-2.5 rounded-lg border border-soft text-xs font-semibold text-prose-muted hover:bg-surface-hover"
          >
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="rounded-xl bg-surface-sunken border border-soft p-3">
      {/*
        ATTRIBUTION ONLY WHEN THERE IS SOMEONE TO ATTRIBUTE TO. On a solo journal
        every line would read "you", which is noise stapled to every entry.
      */}
      {shared && (
        <div className="flex items-center gap-2">
          <Avatar url={note.author.avatarUrl} name={name} />
          <span className="text-xs font-semibold text-prose-muted">
            {note.mine ? 'You' : name}
          </span>
        </div>
      )}

      <p className={`text-sm text-prose whitespace-pre-wrap break-words ${shared ? 'mt-2' : ''}`}>
        {note.body}
      </p>

      <div className="mt-2 flex items-center gap-2 text-xs text-prose-faint">
        <time dateTime={note.createdAt}>
          {new Date(note.createdAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
        {note.editedAt && <span>· edited</span>}

        {note.mine ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="ml-auto px-2 py-1 -my-1 hover:text-prose-muted"
            >
              Edit
            </button>
            <DeleteNoteButton note={note} subject={subject} />
          </>
        ) : (
          <span className="ml-auto flex items-center gap-2">
            {/* The goal owner can also remove anything said in his feed. Both
                policies live in migration 145; deleteNote is one call for both, so
                a non-owner's submit simply matches no rows. Rendering it for
                everyone would promise an action most readers don't have, so this
                stays with the owner — and everyone else gets Report. */}
            {isSubjectOwner ? <DeleteNoteButton note={note} subject={subject} /> : null}
            <ReportNoteControl note={note} />
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Report someone else's note.
 *
 * A <details> rather than a dialog: no client state to manage, works without
 * JavaScript, and it stays collapsed so it never competes with reading the note.
 * Once submitted the panel just closes — there is deliberately NO "reported"
 * badge on the note. The author must not be able to tell, and on a shared feed a
 * visible marker would tell everyone.
 */
function ReportNoteControl({ note }: { note: NoteRow }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none px-2 py-1 -my-1 hover:text-prose-muted">
        Report
      </summary>
      <form action={reportNote} className="mt-2 rounded-lg border border-soft bg-surface p-3">
        <input type="hidden" name="noteId" value={note.id} />
        <label className="sr-only" htmlFor={`reason-${note.id}`}>Why are you reporting this?</label>
        <select
          id={`reason-${note.id}`}
          name="reason"
          defaultValue=""
          required
          className="min-h-11 w-full rounded-lg border border-soft bg-surface-sunken px-3 py-2 text-xs text-prose"
        >
          <option value="" disabled>Pick a reason…</option>
          <option value="harassment">Harassment or abuse</option>
          <option value="threat">Threatening or unsafe</option>
          <option value="spam">Spam</option>
          <option value="other">Something else</option>
        </select>
        <button
          type="submit"
          className="mt-2 min-h-11 w-full rounded-lg border border-strong px-3 py-2 text-xs font-semibold text-prose hover:bg-surface-hover"
        >
          Send report
        </button>
        <p className="mt-2 text-[11px] text-prose-faint">
          Goes to us, not to them. They aren&apos;t told.
        </p>
      </form>
    </details>
  )
}

/**
 * Delete is a form rather than an onClick so it keeps working without client
 * JavaScript, matching the rest of the goals surface.
 */
function DeleteNoteButton({ note, subject }: { note: NoteRow; subject: NoteSubject }) {
  return (
    <form action={deleteNote} className="contents">
      <input type="hidden" name="subjectType" value={subject.type} />
      <input type="hidden" name="subjectId" value={subject.id} />
      <input type="hidden" name="noteId" value={note.id} />
      <button type="submit" className="px-2 py-1 -my-1 hover:text-danger-ink">
        Delete
      </button>
    </form>
  )
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-surface-raised">
        <Image src={url} alt="" fill sizes="24px" className="object-cover" unoptimized />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-raised text-[10px] font-bold text-prose-muted"
    >
      {name.replace('@', '').charAt(0).toUpperCase()}
    </span>
  )
}
