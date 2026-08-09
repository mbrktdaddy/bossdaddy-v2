import { type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { icsRuleLines, RecurrenceError } from '@/lib/goals/recurrence'
import { buildCalendar, type CalendarEvent } from '@/lib/goals/ics'

// The calendar feed. Google, Apple and Outlook fetch this from THEIR servers on a
// schedule, so there is no session, no cookie, and no RLS behind it.
//
// ⚠️ THE TOKEN IS THE ONLY AUTHORIZATION ON THIS ROUTE. There is no second gate to
// fall back on if the lookup below is wrong, and the feed contains real goal titles
// — "Quit smoking", "Take my meds" — plus their schedules. Treat every line of the
// lookup as security-critical, and keep the failure response indistinguishable
// between "no such token" and "token revoked": a different 404 body for each would
// turn this into an oracle for guessing.
//
// Service-role client by necessity, not convenience: the caller cannot be
// authenticated. That's the trade migration 139 documents.

export const dynamic = 'force-dynamic'

type ScheduleRow = {
  id: string
  goal_id: string
  label: string | null
  rrule: string
  start_date: string
  local_time: string
  timezone: string
}

type GoalRow = { id: string; title: string; status: string; target_date: string | null }

/** "20:00:00" → "8:00pm". The exact minute lives in the title now, not the grid. */
function friendlyTime(localTime: string): string {
  const [h, m] = localTime.split(':')
  const hour = Number(h)
  const suffix = hour < 12 ? 'am' : 'pm'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}:${m}${suffix}`
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  // Length floor mirrors the CHECK in migration 139. Cheap rejection before the DB.
  if (!token || token.length < 32) return notFound()

  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('goal_calendar_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()
  const userId = (tokenRow as { user_id: string } | null)?.user_id
  if (!userId) return notFound()

  // Active goals only. A paused goal isn't asking for anything, and an archived one
  // is out of his life — neither belongs on his calendar.
  const { data: goalRows } = await admin
    .from('goals')
    .select('id, title, status, target_date')
    .eq('user_id', userId)
    .eq('status', 'active')
  const goals = new Map(((goalRows ?? []) as GoalRow[]).map((g) => [g.id, g]))

  let events: CalendarEvent[] = []
  if (goals.size > 0) {
    const { data: scheduleRows } = await admin
      .from('goal_schedules')
      .select('id, goal_id, label, rrule, start_date, local_time, timezone')
      .eq('user_id', userId)
      .eq('status', 'active')
      // MUTED SCHEDULES ARE NOW EXCLUDED, reversing the original decision. "Mute
      // silences the nudge, not the commitment" reads well and did not survive
      // contact with a real calendar: mute is the clearest signal a man has that he
      // doesn't want to hear about something, and a split where it means one thing
      // for push and another here is harder to explain than it's worth. It was also
      // a direct contributor to the crowding that prompted this change.
      .eq('muted', false)
      .in('goal_id', [...goals.keys()])

    events = ((scheduleRows ?? []) as ScheduleRow[]).flatMap((schedule) => {
      const goal = goals.get(schedule.goal_id)
      if (!goal) return []

      try {
        const [dtstartLine, rruleLine] = icsRuleLines({
          rrule: schedule.rrule,
          startDate: schedule.start_date,
          // Postgres `time` comes back as HH:MM:SS and the engine demands HH:MM,
          // so this slice is load-bearing, not cosmetic — see sweep.ts, which does
          // the same thing at its own call site. Without it every schedule throws
          // RecurrenceError, the catch below swallows it one row at a time, and the
          // feed serves a perfectly valid EMPTY calendar to every subscriber.
          localTime: schedule.local_time.slice(0, 5),
          timezone: schedule.timezone,
        }, {
          // Chips in the all-day strip rather than blocks on the grid. Two or three
          // daily goals rendered as timed events make a week view unusable — found
          // by subscribing for real. See CalendarEvent.allDay.
          allDay: true,
          // Bounded at the goal's target date. Without this every rule ran to
          // infinity, so a finished eight-week taper kept filling the calendar
          // months after it ended and nothing ever left. Open-ended goals (no
          // target_date) legitimately still recur forever.
          until: goal.target_date,
        })
        const base = schedule.label?.trim()
          ? `${goal.title} — ${schedule.label.trim()}`
          : goal.title
        return [{
          // The schedule's own row id — stable across every poll for as long as the
          // reminder exists. See lib/goals/ics.ts on why that matters. It's also
          // what makes THIS change safe to ship to existing subscribers: clients
          // update the events they already hold instead of deleting and recreating
          // every one of them, which would be a notification storm.
          uid: schedule.id,
          // The time moved into the title when these became all-day. Title FIRST so
          // several goals sort by name in the strip — leading with a 12-hour clock
          // sorts "1:00pm" above "8:00am".
          summary: `${base} · ${friendlyTime(schedule.local_time)}`,
          allDay: true,
          dtstartLine,
          rruleLine,
        }]
      } catch (err) {
        // One unexpandable rule must not take the whole feed down with it — the
        // other reminders are still correct, and a 500 here reads to the calendar
        // client as "subscription broken".
        const why = err instanceof RecurrenceError ? err.message : String(err)
        console.error(`goals calendar: skipping schedule ${schedule.id} — ${why}`)
        return []
      }
    })

    // ONE bad rule is a skip; ALL of them is a broken feed wearing a valid one's
    // clothes. That distinction is what hid the HH:MM:SS bug above — a subscriber
    // sees an empty calendar and reads it as "nothing scheduled", and the per-row
    // catch means nothing else complains. Say it loudly enough to notice.
    const scheduleCount = (scheduleRows ?? []).length
    if (events.length === 0 && scheduleCount > 0) {
      console.error(
        `goals calendar: EVERY schedule failed to expand for user ${userId} ` +
        `(${scheduleCount} active) — serving an empty feed`,
      )
    }
  }

  const body = buildCalendar(events, {
    calendarName: 'Boss Daddy — Goals',
    domain: 'bossdaddylife.com',
  })

  // Best-effort, and after the response is built so a write failure can't cost him
  // his calendar. Answers "is anything actually subscribed", and after a reset,
  // "is something still polling the old link".
  void admin
    .from('goal_calendar_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', token)
    .then(({ error }) => {
      if (error) console.error('goals calendar: last_used_at update failed', error.message)
    })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="boss-daddy-goals.ics"',
      // `private, no-store` keeps this out of every shared cache. The URL is a
      // bearer credential, so a CDN copy would be a copy of the credential's
      // payload sitting somewhere nobody is thinking about.
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      // Belt and braces alongside robots' Disallow: /api/ — a calendar feed must
      // never be indexed, because the URL IS the secret.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  })
}

/**
 * One response for every failure. An unknown token, a revoked token, and a
 * malformed one are indistinguishable on purpose — anything else lets a caller
 * probe for valid tokens.
 */
function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
