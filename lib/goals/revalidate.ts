// Every surface a goal mutation invalidates, in ONE place.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS EXISTS
//
// Goal mutations happen through two different mechanisms, and only one of them
// was clearing Next's caches. The Server Actions in app/(tools)/goals/actions.ts
// called revalidatePath; the seven Route Handlers under app/api/goals/ — create,
// update, schedule, delete, bulk, tap, log — called NOTHING. They wrote to the
// database, issued a 303, and left every already-visited page holding its
// pre-mutation render.
//
// The symptom is nasty because it's INTERMITTENT BY URL. A goal save redirects to
// `/goals/<id>?saved=1`, a URL nobody had visited, so it renders fresh and looks
// fine. A schedule save redirects to `/goals/<id>/edit?saved=1` — also fresh — and
// then the man taps back to `/goals/<id>`, which IS cached, and his reminders
// section shows the schedule he just changed, unchanged. Half his edits appear to
// work. The data was never wrong; only the render was.
//
// So: one function, called by both mechanisms. A new goal surface gets added to
// this list once, rather than to nine call sites minus however many get missed.
//
// ⚠️ CALL ONLY FROM A SERVER ACTION OR A ROUTE HANDLER. revalidatePath throws if
// it runs during render.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Surfaces that list or summarize goals, independent of which one changed.
 *
 * `/account/settings` carries the "What you're working on" list, and `/goals/shared`
 * is the other side of a shared goal — both go stale on a rename or a status change
 * and neither is obvious from the goal page you were standing on.
 */
const SHARED_PATHS = ['/goals', '/today', '/account/settings', '/goals/shared'] as const

/** Paths belonging to one goal. `/share` is here because the partner list and the
 *  feed-reader count both render on the detail page too. */
function pathsFor(goalId: string): string[] {
  return [`/goals/${goalId}`, `/goals/${goalId}/edit`, `/goals/${goalId}/share`]
}

/** Revalidate after a mutation touching several goals — the bulk route. */
export function revalidateGoals(goalIds: readonly string[]): void {
  for (const path of SHARED_PATHS) revalidatePath(path)
  for (const goalId of new Set(goalIds)) {
    if (!goalId) continue
    for (const path of pathsFor(goalId)) revalidatePath(path)
  }
}

/**
 * Revalidate after a mutation touching one goal — or none, when the goal is gone
 * (a delete still has to clear the index it just disappeared from).
 */
export function revalidateGoal(goalId?: string | null): void {
  revalidateGoals(goalId ? [goalId] : [])
}
