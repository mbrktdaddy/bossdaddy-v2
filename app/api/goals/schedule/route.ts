import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertValidSchedule, isValidTimeZone, RecurrenceError, localDateInZone } from '@/lib/goals/recurrence'
import { buildRrule, normalizeDays } from '@/lib/goals/schedule-input'
import { rematerializeSchedule, materializeScheduleById } from '@/lib/goals/sweep'
import { recomputeGoalStats } from '@/lib/goals/stats'

// Create, edit, and remove the schedules on a goal. One handler with an `op`
// field rather than three routes — the validation and re-materialization are
// identical across all three, and splitting them would mean maintaining that
// logic in triplicate.
//
// A goal can carry several: lifting Mon/Wed/Fri PLUS a Sunday weigh-in is one
// goal with two schedules, which the schema always supported and the UI couldn't
// express until now.
//
// WHY EVERY WRITE RE-MATERIALIZES: occurrences are stamped from the rule at
// expansion time. Change the days or the hour and the already-materialized future
// is stale, so it's rebuilt — but only the UNRESOLVED future. Days already
// completed, skipped, or missed are history and stay untouched.

const Base = z.object({
  goalId: z.string().uuid(),
  op: z.enum(['create', 'update', 'delete']),
  scheduleId: z.string().uuid().optional(),
  label: z.string().trim().max(60).optional(),
  when: z.enum(['daily', 'weekdays', 'days', 'monthly']).optional(),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  timezone: z.string().min(1).optional(),
})

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const parsed = Base.safeParse(Object.fromEntries(form.entries()))
  if (!parsed.success) {
    const goalId = String(form.get('goalId') ?? '')
    return bounce(request, goalId, 'That schedule didn\'t look right.')
  }
  const { goalId, op, scheduleId } = parsed.data

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)

  // RLS proves ownership of the parent before anything else happens.
  const { data: goalRow } = await supabase
    .from('goals')
    .select('id')
    .eq('id', goalId)
    .maybeSingle()
  if (!goalRow) return NextResponse.redirect(new URL('/goals', request.url), 303)

  const admin = createAdminClient()

  // ── delete ────────────────────────────────────────────────────────────────
  if (op === 'delete') {
    if (!scheduleId) return bounce(request, goalId, 'Which schedule?')

    // Never leave a goal with no way to nudge. Removing the last schedule would
    // make it a silent record nobody is reminded about — pause or archive the
    // goal instead, which says what it means.
    const { count } = await supabase
      .from('goal_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId)
    if ((count ?? 0) <= 1) {
      return bounce(request, goalId, 'That\'s the only reminder on this goal. Pause the goal instead, or add another first.')
    }

    const { error } = await supabase.from('goal_schedules').delete().eq('id', scheduleId)
    if (error) return bounce(request, goalId, 'Couldn\'t remove that reminder.')

    await recomputeGoalStats(supabase, [goalId])
    return NextResponse.redirect(new URL(`/goals/${goalId}/edit?saved=1`, request.url), 303)
  }

  // ── create + update share all their validation ────────────────────────────
  const { when, localTime, timezone } = parsed.data
  if (!when || !localTime || !timezone) {
    return bounce(request, goalId, 'Pick a time and a timezone.')
  }
  if (!isValidTimeZone(timezone)) {
    return bounce(request, goalId, 'That timezone didn\'t look right.')
  }

  const days = normalizeDays(form.getAll('days').map(String))
  if (when === 'days' && days.length === 0) {
    return bounce(request, goalId, 'Pick at least one day of the week.')
  }
  const channels = form.getAll('channels').map(String)
    .filter((c) => c === 'push' || c === 'email' || c === 'inapp')
  if (!channels.length) {
    return bounce(request, goalId, 'Pick at least one way to be reminded.')
  }

  // A new schedule starts today in ITS OWN zone — not Postgres's current_date,
  // which is UTC and already tomorrow for a US evening.
  const startDate = localDateInZone(new Date(), timezone)
  const rrule = buildRrule(when, startDate, days)

  try {
    assertValidSchedule({ rrule, startDate, localTime, timezone })
  } catch (err) {
    return bounce(request, goalId,
      err instanceof RecurrenceError ? err.message : 'That schedule didn\'t work out.')
  }

  if (op === 'create') {
    const { data, error } = await supabase
      .from('goal_schedules')
      .insert({
        goal_id: goalId,
        user_id: user.id,
        label: emptyToNull(parsed.data.label),
        rrule,
        start_date: startDate,
        local_time: localTime,
        timezone,
        channels,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('goals/schedule create failed', error?.message)
      return bounce(request, goalId, 'Couldn\'t add that reminder.')
    }
    await materializeScheduleById(admin, (data as unknown as { id: string }).id, new Date())
    await recomputeGoalStats(supabase, [goalId])
    return NextResponse.redirect(new URL(`/goals/${goalId}/edit?saved=1`, request.url), 303)
  }

  // ── update ────────────────────────────────────────────────────────────────
  if (!scheduleId) return bounce(request, goalId, 'Which schedule?')

  // start_date is deliberately NOT rewritten. It anchors the rule's phase (a
  // monthly BYMONTHDAY, an interval count), and moving it would shift every
  // future occurrence of a schedule the user only wanted to retime.
  const { error } = await supabase
    .from('goal_schedules')
    .update({
      label: emptyToNull(parsed.data.label),
      rrule,
      local_time: localTime,
      timezone,
      channels,
    })
    .eq('id', scheduleId)
  if (error) {
    console.error('goals/schedule update failed', error.message)
    return bounce(request, goalId, 'Couldn\'t save that reminder.')
  }

  await rematerializeSchedule(admin, scheduleId, new Date())
  await recomputeGoalStats(supabase, [goalId])
  return NextResponse.redirect(new URL(`/goals/${goalId}/edit?saved=1`, request.url), 303)
}

function bounce(request: NextRequest, goalId: string, message: string): NextResponse {
  const url = new URL(goalId ? `/goals/${goalId}/edit` : '/goals', request.url)
  url.searchParams.set('msg', message)
  return NextResponse.redirect(url, 303)
}

function emptyToNull(value: string | undefined): string | null {
  return value == null || value.trim() === '' ? null : value.trim()
}
