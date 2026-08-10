// Shared vocabulary for the notes feed — the only part of it that crosses the
// server/client boundary.
//
// THIS FILE HAS NO `server-only` AND NO `use server`, DELIBERATELY, and both
// omissions are the point:
//
//   • lib/goals/notes.ts is `server-only`, so a client component that imported
//     MAX_NOTE_LENGTH from there would fail the build.
//   • lib/goals/note-actions.ts is `use server`, where every export must be an
//     async function — a plain constant there is a build error too.
//
// So the constants and types both sides need live here, on their own, with no
// runtime dependencies to drag across the boundary.

/** Which spine a feed hangs off. Matches the CHECK on goal_notes.subject_type. */
export type NoteSubjectType = 'goal' | 'savings_goal'

export type NoteSubject = { type: NoteSubjectType; id: string }

/** What the caller may do in a feed. Mirrors goal_note_access's return values. */
export type NoteAccess = 'none' | 'read' | 'write'

export type NoteRow = {
  id: string
  body: string
  createdAt: string
  /** Null until the author edits it. Stamped by a trigger, not by the client. */
  editedAt: string | null
  author: {
    id: string
    username: string | null
    displayName: string | null
    avatarUrl: string | null
  }
  /** Convenience for the renderer; the caller already knows who it is. */
  mine: boolean
}

/** Body cap. Matches MAX_BODY in lib/messaging.ts and the CHECK in migration 145. */
export const MAX_NOTE_LENGTH = 4000

export type NoteActionState = {
  /**
   * ⚠️ EXPLICIT, NOT INFERRED FROM `error === null`. Success and "hasn't run yet"
   *    are both error-free, and a UI that can't tell them apart treats MOUNT as
   *    SUCCESS. That is not theoretical here: every note's edit form calls back to
   *    a shared `editingId` when it sees success, so an inferred check meant a
   *    partner posting mid-edit would mount a new row, fire its callback, and close
   *    the editor you were typing in — losing the text. One field, no ambiguity.
   */
  status: 'idle' | 'done' | 'error'
  error: string | null
  /**
   * Handed back on failure so the composer can restore what was typed. Losing a
   * long note to a rate limit would be worse than the rate limit.
   */
  draft?: string
}

/** Initial state for useActionState. */
export const NOTE_IDLE: NoteActionState = { status: 'idle', error: null }

/** Success. Distinct from NOTE_IDLE by `status`, which is the whole point. */
export const NOTE_DONE: NoteActionState = { status: 'done', error: null }

export function noteFailed(error: string, draft: string): NoteActionState {
  return { status: 'error', error, draft }
}

export function isNoteSubjectType(v: unknown): v is NoteSubjectType {
  return v === 'goal' || v === 'savings_goal'
}
