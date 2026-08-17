// How a timestamp reads in an ACTIVITY LIST — a conversation row or a
// notification row. Not inside a thread: that has day separators and shows a
// plain clock time on every message, which is a different job.
//
// ⚠️ CLIENT-ONLY, OR MOUNT-GATED. Everything here is locale- and timezone-
// dependent, so calling it during SSR renders the SERVER's timezone and then
// hydration finds different text. The thread already gates its clock behind a
// `mounted` flag for exactly this reason; the conversation list is a client
// component and formats after mount.
//
// Lives in lib/ rather than beside one component because three surfaces render
// the same rows — the header bell's Messages tab, its Notifications tab, and
// /account/messages. If they formatted differently, one thread would appear to
// have two different last-activity times depending on where you looked.

/**
 * The escalating format every messenger converged on, and for good reason: within
 * a day the useful fact is the CLOCK ("did she reply before I left?"), within a
 * week it's the DAY, and beyond that it's the DATE. A single relative form
 * ("13 days ago") makes the reader do arithmetic to get back to any of those.
 *
 * `now` is injectable so this is testable without freezing the clock.
 */
export function activityTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'

  // Calendar days apart, not elapsed milliseconds: 6 days ago at 11pm and 6 days
  // ago at 1am are both "last week" to a reader, and an hours-based threshold
  // would show one as a weekday and the other as a date.
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfThen = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const daysApart = Math.round((startOfToday.getTime() - startOfThen.getTime()) / 86_400_000)

  // Under a week, a weekday name is instantly placeable. Past that it repeats
  // ("Tue" could be 3 days or 10), so it has to become a date.
  if (daysApart > 0 && daysApart < 7) return d.toLocaleDateString([], { weekday: 'short' })

  return d.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  })
}
