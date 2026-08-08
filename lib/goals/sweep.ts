// The goals sweep — materialize, notify, age out. Called by
// app/api/cron/goals-sweep/route.ts every 15 minutes.
//
// Three phases, deliberately in this order:
//
//   1. MATERIALIZE  top active schedules up to a rolling 60-day horizon.
//   2. NOTIFY       send for every pending occurrence now due, through the
//                   `goal_deliveries` outbox so a retry can't double-send.
//   3. AGE OUT      pending past due_at + grace → `missed`, silently; snoozed
//                   rows whose snooze has lapsed → back to `pending`.
//
// WHY 15 MINUTES: hourly cannot express an 8:30 am reminder, and "set your
// reminder for 8:00 or 9:00" is the tool telling the user its own schema is his
// problem. */15 costs four scans an hour against a partial index sized to the
// work queue, not to history.
//
// QUERY BUDGET: a tick is a FIXED ~10 statements no matter how many occurrences
// are due — 3 loads, 3 bulk claims, 1 bulk settle, 1 bulk status update, plus
// age-out. The first cut did claim/settle/mark per occurrence, which was ~1,000
// round trips for a 300-occurrence tick; runtime then scaled with volume TIMES
// per-query latency. Only the sends stay per-occurrence, since those are network
// calls to three separate providers.
//
// The sends are intentionally sequential. Resend's rate limit is low single-digit
// requests per second, so firing 300 emails in parallel buys throttling, not
// speed. Wall clock here is provider-bound, not database-bound.
//
// WHY A ROLLING WINDOW AT ALL: materializing gives each instance somewhere to
// hold per-instance state (snoozed to 9 pm, skipped, its own curve target) and
// turns the sweep into `where status='pending' and due_at <= now()` — an index
// scan instead of re-expanding every RRULE in the table on every tick.

import 'server-only'
import * as React from 'react'
import type { createAdminClient } from '@/lib/supabase/admin'
import { expandOccurrences, type GoalSchedule } from '@/lib/goals/recurrence'
import { targetForDate, type CurveInput } from '@/lib/goals/curve'
import { oneTapUrl } from '@/lib/goals/links'
import { recomputeGoalStats } from '@/lib/goals/stats'
import { sendPushToUser } from '@/lib/push'
import { sendEmail } from '@/lib/email'
import { GoalReminderEmail } from '@/emails/GoalReminderEmail'

/** How far ahead occurrences are materialized. */
export const HORIZON_DAYS = 60
/** Occurrences older than this are never notified — a backlog isn't a nudge. */
const STALE_AFTER_MINUTES = 180
/** Safety rails so one bad tick can't run away. */
const MAX_SCHEDULES_PER_TICK = 200
const MAX_DUE_PER_TICK = 300

// Derived from the factory so it can never drift from what the route passes in,
// and so inserts here are checked against the regenerated Database types.
type Admin = ReturnType<typeof createAdminClient>

type ScheduleRow = {
  id: string
  goal_id: string
  user_id: string
  label: string | null
  rrule: string
  start_date: string
  local_time: string
  timezone: string
  lead_minutes: number
  grace_minutes: number
  channels: string[]
  materialized_through: string | null
}

type GoalRow = CurveInput & {
  id: string
  title: string
  kind: string
  metric_key: string | null
  metric_unit: string | null
  status: string
}

type DueRow = {
  id: string
  goal_id: string
  schedule_id: string
  user_id: string
  due_at: string
  local_date: string
  local_time: string
  shifted: boolean
  target_value: number | null
  snoozed_until: string | null
}

export type SweepReport = {
  materializedSchedules: number
  occurrencesCreated: number
  due: number
  notified: number
  pushSent: number
  emailSent: number
  inAppSent: number
  suppressed: number
  missed: number
  reArmed: number
  statsRecomputed: number
  errors: string[]
}

export async function runGoalsSweep(
  admin: Admin,
  now: Date,
  siteUrl: string,
): Promise<SweepReport> {
  const report: SweepReport = {
    materializedSchedules: 0, occurrencesCreated: 0, due: 0, notified: 0,
    pushSent: 0, emailSent: 0, inAppSent: 0, suppressed: 0, missed: 0,
    reArmed: 0, statsRecomputed: 0, errors: [],
  }

  // Goals this tick moved in any way. Their derived stats are stale afterwards,
  // so they get recomputed once at the end rather than per phase.
  const touched = new Set<string>()

  await materialize(admin, now, report, touched)
  await notifyDue(admin, now, siteUrl, report, touched)
  await ageOut(admin, now, report, touched)
  await refreshStaleStats(admin, now, report, touched)

  if (touched.size) {
    const { updated, errors } = await recomputeGoalStats(admin, [...touched], now)
    report.statsRecomputed = updated
    report.errors.push(...errors)
  }

  return report
}

// ── phase 1: materialize ────────────────────────────────────────────────────

async function materialize(
  admin: Admin,
  now: Date,
  report: SweepReport,
  touched: Set<string>,
): Promise<void> {
  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000)
  // Top up anything that has never been expanded or whose window closes within
  // the next week, so a schedule can never run dry between ticks.
  const topUpBefore = new Date(now.getTime() + 7 * 86_400_000).toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('goal_schedules')
    .select('id, goal_id, user_id, label, rrule, start_date, local_time, timezone, lead_minutes, grace_minutes, channels, materialized_through')
    .eq('status', 'active')
    .eq('muted', false)
    .or(`materialized_through.is.null,materialized_through.lte.${topUpBefore}`)
    .limit(MAX_SCHEDULES_PER_TICK)
  if (error) {
    report.errors.push(`materialize/load: ${error.message}`)
    return
  }
  const schedules = (data ?? []) as unknown as ScheduleRow[]
  if (!schedules.length) return

  const goals = await loadGoals(admin, schedules.map((s) => s.goal_id), report)

  for (const schedule of schedules) {
    const goal = goals.get(schedule.goal_id)
    // Paused or archived parent — leave the schedule alone rather than
    // expanding occurrences nobody will be asked to do.
    if (!goal || goal.status !== 'active') continue
    await materializeOne(admin, schedule, goal, horizonEnd, report)
    touched.add(schedule.goal_id)
  }
}

/**
 * Expand one schedule into occurrences and advance its window pointer.
 *
 * Extracted so goal creation can call it directly — a dad who just set up a goal
 * should see today's target immediately, not an empty page until the next
 * quarter-hour tick.
 */
async function materializeOne(
  admin: Admin,
  schedule: ScheduleRow,
  goal: GoalRow,
  horizonEnd: Date,
  report: SweepReport,
): Promise<void> {
  // Resume from where we left off, never before the schedule's own start.
  const startMs = new Date(`${schedule.start_date}T00:00:00Z`).getTime()
  const resumeMs = schedule.materialized_through
    ? new Date(`${schedule.materialized_through}T00:00:00Z`).getTime()
    : startMs
  const from = new Date(Math.max(resumeMs, startMs))

  let occurrences
  try {
    occurrences = expandOccurrences(toGoalSchedule(schedule), from, horizonEnd)
  } catch (err) {
    // A rule that can't expand is a data problem, not a transient one. Log it
    // and move on — one broken schedule must not stall everyone else's.
    report.errors.push(`materialize/${schedule.id}: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  const through = horizonEnd.toISOString().slice(0, 10)
  if (!occurrences.length) {
    await admin.from('goal_schedules').update({ materialized_through: through }).eq('id', schedule.id)
    return
  }

  const rows = occurrences.map((o) => ({
    goal_id: schedule.goal_id,
    schedule_id: schedule.id,
    user_id: schedule.user_id,
    due_at: o.dueAt.toISOString(),
    local_date: o.localDate,
    local_time: o.localTime,
    shifted: o.shifted,
    target_value: targetForDate(goal, o.localDate),
  }))

  // `unique (schedule_id, due_at)` makes re-running this a no-op instead of a
  // duplicate nudge, so the sweep is safe to retry, overlap, or redeploy
  // mid-run. ignoreDuplicates keeps existing per-instance state (a snooze, a
  // completion) from being clobbered by a fresh materialization.
  const { error: insertError, count } = await admin
    .from('goal_occurrences')
    .upsert(rows, { onConflict: 'schedule_id,due_at', ignoreDuplicates: true, count: 'exact' })
  if (insertError) {
    report.errors.push(`materialize/${schedule.id} insert: ${insertError.message}`)
    return
  }

  await admin.from('goal_schedules').update({ materialized_through: through }).eq('id', schedule.id)

  report.materializedSchedules++
  report.occurrencesCreated += count ?? 0
}

/**
 * Rebuilds a schedule's future window after its rule, time, zone, or the goal's
 * curve changed.
 *
 * ONLY UNRESOLVED FUTURE OCCURRENCES ARE DISCARDED. Anything already completed,
 * skipped, or missed is history — a dad who moves his reminder from 8pm to 7pm
 * must not lose the twelve days he already logged, and a target he was actually
 * asked for on March 3rd must not retroactively change because he extended his
 * end date. Past-dated pending rows are also left alone so a catch-up stays
 * available.
 *
 * Resetting `materialized_through` is what makes the re-expansion start from the
 * schedule's own start date instead of resuming at the old horizon.
 */
export async function rematerializeSchedule(
  admin: Admin,
  scheduleId: string,
  now: Date,
): Promise<number> {
  const { error: clearError } = await admin
    .from('goal_occurrences')
    .delete()
    .eq('schedule_id', scheduleId)
    .in('status', ['pending', 'snoozed'])
    .gt('due_at', now.toISOString())
  if (clearError) {
    console.error('rematerializeSchedule/clear', clearError.message)
    return 0
  }

  const { error: pointerError } = await admin
    .from('goal_schedules')
    .update({ materialized_through: null })
    .eq('id', scheduleId)
  if (pointerError) {
    console.error('rematerializeSchedule/pointer', pointerError.message)
    return 0
  }

  return materializeScheduleById(admin, scheduleId, now)
}

/**
 * Materialize a single schedule by id, loading what it needs. Used by the create
 * flow so a brand-new goal has its window populated before the page renders.
 * Returns the number of occurrences written (0 on any problem — the next sweep
 * tick will pick it up regardless, so this is best-effort by design).
 */
export async function materializeScheduleById(
  admin: Admin,
  scheduleId: string,
  now: Date,
): Promise<number> {
  const report: SweepReport = {
    materializedSchedules: 0, occurrencesCreated: 0, due: 0, notified: 0,
    pushSent: 0, emailSent: 0, inAppSent: 0, suppressed: 0, missed: 0,
    reArmed: 0, statsRecomputed: 0, errors: [],
  }

  const { data } = await admin
    .from('goal_schedules')
    .select('id, goal_id, user_id, label, rrule, start_date, local_time, timezone, lead_minutes, grace_minutes, channels, materialized_through')
    .eq('id', scheduleId)
    .maybeSingle()
  const schedule = data as unknown as ScheduleRow | null
  if (!schedule) return 0

  const goals = await loadGoals(admin, [schedule.goal_id], report)
  const goal = goals.get(schedule.goal_id)
  if (!goal) return 0

  const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * 86_400_000)
  await materializeOne(admin, schedule, goal, horizonEnd, report)
  // Stats immediately, so a brand-new goal's index card isn't blank until the
  // next tick.
  const stats = await recomputeGoalStats(admin, [schedule.goal_id], now)
  report.errors.push(...stats.errors)
  if (report.errors.length) console.error('materializeScheduleById', report.errors)
  return report.occurrencesCreated
}

// ── phase 2: notify ─────────────────────────────────────────────────────────

async function notifyDue(
  admin: Admin,
  now: Date,
  siteUrl: string,
  report: SweepReport,
  touched: Set<string>,
): Promise<void> {
  // A schedule's lead_minutes shifts its nudge earlier than due_at, so the
  // window has to look ahead by the largest lead in play rather than at now().
  const lookahead = new Date(now.getTime() + 24 * 60 * 60_000)
  const { data, error } = await admin
    .from('goal_occurrences')
    .select('id, goal_id, schedule_id, user_id, due_at, local_date, local_time, shifted, target_value, snoozed_until')
    .eq('status', 'pending')
    .lte('due_at', lookahead.toISOString())
    .order('due_at', { ascending: true })
    .limit(MAX_DUE_PER_TICK)
  if (error) {
    report.errors.push(`notify/load: ${error.message}`)
    return
  }
  const candidates = (data ?? []) as unknown as DueRow[]
  if (!candidates.length) return

  const schedules = await loadSchedules(admin, candidates.map((c) => c.schedule_id), report)
  const goals = await loadGoals(admin, candidates.map((c) => c.goal_id), report)

  // Only look up emails for users who actually have something due. The savings
  // cron calls auth.admin.listUsers({ perPage: 1000 }) on every tick — O(all
  // users) per invocation, and it silently stops finding anyone past 1000
  // accounts. Do not copy that.
  const dueNow: DueRow[] = []
  for (const occurrence of candidates) {
    const schedule = schedules.get(occurrence.schedule_id)
    const goal = goals.get(occurrence.goal_id)
    if (!schedule || !goal || goal.status !== 'active') continue
    // A re-armed snooze is measured from when the snooze expired, not from the
    // original due time — otherwise snoozing past the staleness window silently
    // kills the reminder.
    const sendAt = Math.max(
      new Date(occurrence.due_at).getTime() - schedule.lead_minutes * 60_000,
      occurrence.snoozed_until ? new Date(occurrence.snoozed_until).getTime() : 0,
    )
    if (sendAt > now.getTime()) continue
    // Too old to be a nudge. Age-out will mark it missed.
    if (now.getTime() - sendAt > STALE_AFTER_MINUTES * 60_000) continue
    dueNow.push(occurrence)
  }
  report.due = dueNow.length
  if (!dueNow.length) return
  for (const occurrence of dueNow) touched.add(occurrence.goal_id)

  const emails = await loadEmails(admin, [...new Set(dueNow.map((o) => o.user_id))], report)

  // Everything below is BULK. The previous shape did claim → send → settle →
  // mark per occurrence, which is 3–4 sequential round trips each: ~1,000
  // queries for a 300-occurrence tick. That grows with users TIMES per-query
  // latency, so it degrades in exactly the situation you least want it to.
  //
  // Now it's a fixed handful of statements per tick regardless of volume. Only
  // the sends themselves stay per-occurrence, because they're network calls to
  // three different providers — and they stay sequential on purpose: Resend's
  // rate limit is low single-digit requests per second, and a burst of 300
  // parallel emails would get us throttled rather than fast.
  const settlements: DeliverySettle[] = []
  const landed = new Set<string>()          // occurrence ids where something arrived
  const context = new Map<string, SendContext>()

  for (const occurrence of dueNow) {
    const schedule = schedules.get(occurrence.schedule_id)!
    const goal = goals.get(occurrence.goal_id)!
    const tapUrl = oneTapUrl(occurrence.id, siteUrl, now)
    context.set(occurrence.id, {
      occurrence,
      schedule,
      goal,
      tapUrl,
      goalUrl: `${siteUrl}/goals/${goal.id}`,
      copy: reminderCopy(goal, occurrence, schedule),
    })
  }

  // ── push: one claim, then the sends ───────────────────────────────────────
  const pushTargets = dueNow.filter((o) => schedules.get(o.schedule_id)!.channels.includes('push'))
  const pushClaimed = await claimDeliveries(admin, pushTargets, 'push', report)
  for (const occurrence of pushTargets) {
    if (!pushClaimed.has(occurrence.id)) continue
    const ctx = context.get(occurrence.id)!
    const result = await sendPushToUser(occurrence.user_id, {
      title: ctx.copy.title,
      body: ctx.copy.body,
      url: ctx.tapUrl ?? ctx.goalUrl,
      tag: `goal-${occurrence.id}`,
    })
    const ok = result.attempted && result.delivered > 0
    if (ok) { report.pushSent++; landed.add(occurrence.id) } else report.suppressed++
    settlements.push(settlement(occurrence, 'push', ok, ok ? null : describePush(result)))
  }

  // ── email: one claim, then the sends ─────────────────────────────────────
  // Email is the fallback that keeps the system honest when push is dead, so a
  // schedule that only asked for push still gets an email when push reached no
  // device. That's why this claim can't be merged with the push claim above —
  // the target set isn't known until the pushes have actually been attempted.
  const emailTargets = dueNow.filter((o) => {
    const wantsEmail = schedules.get(o.schedule_id)!.channels.includes('email')
    return wantsEmail || !landed.has(o.id)
  })
  const emailClaimed = await claimDeliveries(admin, emailTargets, 'email', report)
  for (const occurrence of emailTargets) {
    if (!emailClaimed.has(occurrence.id)) continue
    const ctx = context.get(occurrence.id)!
    const to = emails.get(occurrence.user_id)
    if (!to) {
      report.suppressed++
      settlements.push(settlement(occurrence, 'email', false, 'no email on file'))
      continue
    }
    const result = await sendEmail({
      to,
      subject: ctx.copy.subject,
      tag: 'goal_reminder',
      react: React.createElement(GoalReminderEmail, {
        goalTitle: ctx.goal.title,
        eyebrow: ctx.copy.eyebrow,
        headline: ctx.copy.title,
        detail: ctx.copy.body,
        shiftedNote: occurrence.shifted
          ? `Clocks changed overnight — this one lands at ${occurrence.local_time} today.`
          : null,
        actionUrl: ctx.tapUrl ?? ctx.goalUrl,
        // Reminder controls live on the detail page (mute per schedule), so
        // there's no separate /edit route to keep in sync.
        manageUrl: ctx.goalUrl,
        siteUrl,
      }),
    })
    if (result.ok) { report.emailSent++; landed.add(occurrence.id) } else report.suppressed++
    settlements.push(settlement(occurrence, 'email', result.ok, result.ok ? null : result.error))
  }

  // ── in-app: one claim, one bulk insert into the existing feed ────────────
  // Writes into `notifications` (mig 082) rather than a second feed, so the
  // header bell and /account/notifications work unchanged.
  const inAppTargets = dueNow.filter((o) => schedules.get(o.schedule_id)!.channels.includes('inapp'))
  const inAppClaimed = await claimDeliveries(admin, inAppTargets, 'inapp', report)
  const inAppRows = inAppTargets
    .filter((o) => inAppClaimed.has(o.id))
    .map((o) => {
      const ctx = context.get(o.id)!
      return {
        user_id: o.user_id,
        type: 'goal_reminder',
        title: ctx.copy.title,
        body: ctx.copy.body,
        link: ctx.tapUrl ? `/g/${ctx.tapUrl.split('/g/')[1]}` : `/goals/${ctx.goal.id}`,
        payload: { goal_id: ctx.goal.id, occurrence_id: o.id },
      }
    })
  if (inAppRows.length) {
    const { error: notifyError } = await admin.from('notifications').insert(inAppRows)
    for (const row of inAppRows) {
      const occurrenceId = String((row.payload as { occurrence_id: string }).occurrence_id)
      const occurrence = dueNow.find((o) => o.id === occurrenceId)!
      if (!notifyError) { report.inAppSent++; landed.add(occurrenceId) }
      settlements.push(settlement(occurrence, 'inapp', !notifyError, notifyError?.message ?? null))
    }
  }

  // ── two statements to close out the whole tick ───────────────────────────
  await settleDeliveries(admin, settlements, report)

  if (landed.size) {
    const { error: markError } = await admin
      .from('goal_occurrences')
      .update({ status: 'notified' })
      .in('id', [...landed])
      .eq('status', 'pending')
    if (markError) report.errors.push(`notify/mark: ${markError.message}`)
    else report.notified = landed.size
  }
}

type SendContext = {
  occurrence: DueRow
  schedule: ScheduleRow
  goal: GoalRow
  tapUrl: string | null
  goalUrl: string
  copy: { title: string; body: string; subject: string; eyebrow: string }
}

type DeliverySettle = {
  occurrence_id: string
  user_id: string
  channel: string
  status: string
  attempts: number
  sent_at: string | null
  last_error: string | null
}

function settlement(
  occurrence: DueRow,
  channel: string,
  ok: boolean,
  error: string | null,
): DeliverySettle {
  return {
    occurrence_id: occurrence.id,
    user_id: occurrence.user_id,
    channel,
    status: ok ? 'sent' : 'failed',
    attempts: 1,
    sent_at: ok ? new Date().toISOString() : null,
    last_error: error,
  }
}

/**
 * Reserves (occurrence, channel) for a whole batch in ONE statement, and returns
 * the occurrence ids this tick actually won.
 *
 * `ignoreDuplicates` compiles to `ON CONFLICT DO NOTHING`, and Postgres's
 * `... DO NOTHING RETURNING` returns only the rows that were really inserted —
 * so the returned set IS the claim set. Rows another invocation already holds
 * come back absent rather than as errors, which is what makes an overlapping
 * tick, a retry, or a redeploy mid-run harmless instead of a double-send.
 *
 * On a query error nothing is claimed and therefore nothing sends this tick. The
 * next tick retries. Silence is the right failure mode here — the alternative is
 * sending a reminder we can't prove we haven't already sent.
 */
async function claimDeliveries(
  admin: Admin,
  occurrences: DueRow[],
  channel: string,
  report: SweepReport,
): Promise<Set<string>> {
  if (!occurrences.length) return new Set()
  const rows = occurrences.map((o) => ({
    occurrence_id: o.id,
    user_id: o.user_id,
    channel,
    status: 'queued',
    attempts: 1,
  }))
  const { data, error } = await admin
    .from('goal_deliveries')
    .upsert(rows, { onConflict: 'occurrence_id,channel', ignoreDuplicates: true })
    .select('occurrence_id')
  if (error) {
    report.errors.push(`claim/${channel}: ${error.message}`)
    return new Set()
  }
  return new Set(((data ?? []) as unknown as { occurrence_id: string }[]).map((d) => d.occurrence_id))
}

/**
 * Writes every send outcome in one statement. These rows already exist (we
 * claimed them), so the upsert takes the UPDATE path on the same unique pair —
 * which is how per-row status, sent_at, and last_error land in a single query
 * instead of one round trip each.
 */
async function settleDeliveries(
  admin: Admin,
  settlements: DeliverySettle[],
  report: SweepReport,
): Promise<void> {
  if (!settlements.length) return
  const { error } = await admin
    .from('goal_deliveries')
    .upsert(settlements, { onConflict: 'occurrence_id,channel' })
  if (error) report.errors.push(`settle: ${error.message}`)
}

// ── phase 3: age out ────────────────────────────────────────────────────────

async function ageOut(
  admin: Admin,
  now: Date,
  report: SweepReport,
  touched: Set<string>,
): Promise<void> {
  // Re-arm lapsed snoozes first, so a snooze that expired into a still-valid
  // window gets its nudge on this tick instead of next.
  //
  // `snoozed_until` is deliberately NOT cleared. notifyDue reads it as the
  // effective send time, so a snoozed nudge is judged fresh from when the snooze
  // expired rather than from the original due_at. Clearing it meant a reminder
  // snoozed past the staleness window silently stopped arriving and then got
  // marked missed — i.e. snooze stopped working after about three hours.
  const { data: reArmed, error: reArmError } = await admin
    .from('goal_occurrences')
    .update({ status: 'pending' })
    .eq('status', 'snoozed')
    .lte('snoozed_until', now.toISOString())
    .select('id')
  if (reArmError) report.errors.push(`ageOut/reArm: ${reArmError.message}`)
  else report.reArmed = reArmed?.length ?? 0

  // Grace is per-schedule, so this can't be one blanket UPDATE. Pull the
  // stragglers with their grace window and mark only the genuinely lapsed.
  const { data, error } = await admin
    .from('goal_occurrences')
    .select('id, due_at, schedule_id, goal_id')
    .in('status', ['pending', 'notified'])
    .lte('due_at', now.toISOString())
    .limit(1000)
  if (error) {
    report.errors.push(`ageOut/load: ${error.message}`)
    return
  }
  const stragglers = (data ?? []) as unknown as
    { id: string; due_at: string; schedule_id: string; goal_id: string }[]
  if (!stragglers.length) return

  const schedules = await loadSchedules(admin, stragglers.map((s) => s.schedule_id), report)
  // A PAUSED OR ARCHIVED GOAL MUST NOT ACCUMULATE MISSES. Its future occurrences
  // are already materialized, and without this filter they aged into `missed` one
  // by one — quietly wrecking the adherence percentage on a goal the user
  // deliberately parked, and contradicting the rule that a miss is a fact we
  // record rather than a punishment we invent.
  const goals = await loadGoals(admin, stragglers.map((s) => s.goal_id), report)

  const lapsed = stragglers.filter((s) => {
    if (goals.get(s.goal_id)?.status !== 'active') return false
    const grace = schedules.get(s.schedule_id)?.grace_minutes ?? 240
    return new Date(s.due_at).getTime() + grace * 60_000 <= now.getTime()
  })
  if (!lapsed.length) return

  // Silent by design. A missed day is a fact we record, never an event we
  // announce — no "streak broken" push, no red banner. The catch-up affordance
  // is offered in the UI; it is never demanded.
  const { error: missError } = await admin
    .from('goal_occurrences')
    .update({ status: 'missed', resolved_at: now.toISOString() })
    .in('id', lapsed.map((l) => l.id))
  if (missError) report.errors.push(`ageOut/mark: ${missError.message}`)
  else {
    report.missed = lapsed.length
    for (const row of lapsed) touched.add(row.goal_id)
  }
}

// ── phase 4: self-heal stale or missing stats ───────────────────────────────

/** Stats older than this are refreshed even if nothing else touched the goal. */
const STATS_STALE_AFTER_MINUTES = 90
/** Bounded so a big cold start spreads over several ticks instead of one long one. */
const MAX_STATS_REFRESH_PER_TICK = 50

/**
 * Recomputes stats for goals nothing else touched.
 *
 * Without this, `goal_stats` only ever gets written for goals the tick actually
 * moved — and a goal materialized 60 days out, with nothing due right now, is
 * touched by nothing. Goals that existed before migration 135 would therefore
 * never get a stats row at all, and the index would report "no run going yet" for
 * a goal with a real streak: not a crash, just quietly wrong, which is worse.
 *
 * Self-healing rather than a one-off backfill, so the same code covers the
 * migration's cold start, a manually deleted row, and any future drift.
 */
async function refreshStaleStats(
  admin: Admin,
  now: Date,
  report: SweepReport,
  touched: Set<string>,
): Promise<void> {
  const { data: goalRows, error: goalError } = await admin
    .from('goals')
    .select('id')
    .in('status', ['active', 'paused'])
    .limit(500)
  if (goalError) {
    report.errors.push(`staleStats/goals: ${goalError.message}`)
    return
  }
  const goalIds = ((goalRows ?? []) as unknown as { id: string }[]).map((g) => g.id)
  if (!goalIds.length) return

  const { data: statRows, error: statError } = await admin
    .from('goal_stats')
    .select('goal_id, computed_at')
    .in('goal_id', goalIds)
  if (statError) {
    report.errors.push(`staleStats/stats: ${statError.message}`)
    return
  }
  const computedAt = new Map(
    ((statRows ?? []) as unknown as { goal_id: string; computed_at: string }[])
      .map((s) => [s.goal_id, s.computed_at]),
  )

  const cutoff = now.getTime() - STATS_STALE_AFTER_MINUTES * 60_000
  let added = 0
  for (const goalId of goalIds) {
    if (added >= MAX_STATS_REFRESH_PER_TICK) break
    if (touched.has(goalId)) continue
    const stamp = computedAt.get(goalId)
    // Missing row, or one old enough that a day boundary may have moved under it
    // (today_local_date and open_count both go stale with the clock).
    if (!stamp || new Date(stamp).getTime() < cutoff) {
      touched.add(goalId)
      added++
    }
  }
}

// ── shared loaders + copy ───────────────────────────────────────────────────

async function loadGoals(admin: Admin, ids: string[], report: SweepReport): Promise<Map<string, GoalRow>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const { data, error } = await admin
    .from('goals')
    .select('id, title, kind, metric_key, metric_unit, status, curve, baseline_value, target_value, started_on, target_date, step_every_days')
    .in('id', unique)
  if (error) {
    report.errors.push(`loadGoals: ${error.message}`)
    return new Map()
  }
  return new Map(((data ?? []) as unknown as GoalRow[]).map((g) => [g.id, g]))
}

async function loadSchedules(admin: Admin, ids: string[], report: SweepReport): Promise<Map<string, ScheduleRow>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map()
  const { data, error } = await admin
    .from('goal_schedules')
    .select('id, goal_id, user_id, label, rrule, start_date, local_time, timezone, lead_minutes, grace_minutes, channels, materialized_through')
    .in('id', unique)
  if (error) {
    report.errors.push(`loadSchedules: ${error.message}`)
    return new Map()
  }
  return new Map(((data ?? []) as unknown as ScheduleRow[]).map((s) => [s.id, s]))
}

/**
 * Emails for a specific set of users. `getUserById` per id rather than
 * `listUsers({ perPage: 1000 })` over the whole table — see the note in
 * notifyDue. Capped concurrency keeps a big tick from hammering the auth API.
 */
async function loadEmails(admin: Admin, userIds: string[], report: SweepReport): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const BATCH = 10
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH)
    await Promise.all(batch.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id)
      if (error) { report.errors.push(`loadEmails/${id}: ${error.message}`); return }
      if (data.user?.email) out.set(id, data.user.email)
    }))
  }
  return out
}

function toGoalSchedule(schedule: ScheduleRow): GoalSchedule {
  return {
    rrule: schedule.rrule,
    startDate: schedule.start_date,
    // Postgres `time` comes back as HH:MM:SS.
    localTime: schedule.local_time.slice(0, 5),
    timezone: schedule.timezone,
  }
}

function describePush(result: { attempted: boolean; pruned: number; failed: number }): string {
  if (!result.attempted) return 'no live push subscription'
  return `push reached no device (pruned ${result.pruned}, failed ${result.failed})`
}

/**
 * Kind-aware, non-shaming copy. A taper nudge names today's allowance, not the
 * finish line; an adherence nudge is a single quiet question. Nothing here
 * counts down failures or mentions a broken streak — see brand-guide §1.6 on
 * edge-off topics, which cessation and medication both are.
 */
function reminderCopy(goal: GoalRow, occurrence: DueRow, schedule: ScheduleRow): {
  title: string; body: string; subject: string; eyebrow: string
} {
  const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''
  const target = occurrence.target_value
  const label = schedule.label?.trim() || goal.title
  const eyebrow = `${goal.title}${schedule.label?.trim() ? ` · ${schedule.label.trim()}` : ''}`

  switch (goal.kind) {
    case 'reduce':
      return {
        title: target != null ? `Today's number: ${fmt(target)}${unit}` : `${goal.title} — check in`,
        body: target != null
          ? `Log where you actually landed today. Honest beats pretty.`
          : `Log where you landed today.`,
        subject: target != null ? `${goal.title} — today's number is ${fmt(target)}` : `${goal.title} — check in`,
        eyebrow,
      }
    case 'adherence':
      return {
        title: `${label} — done yet?`,
        body: 'One tap and you\'re clear for today.',
        subject: `${label} — one tap to log it`,
        eyebrow,
      }
    case 'program':
      return {
        title: `${label} is on for today`,
        body: target != null ? `Today's target: ${fmt(target)}${unit}.` : 'Log it when it\'s done.',
        subject: `${label} — on for today`,
        eyebrow,
      }
    case 'metric':
      return {
        title: `Time to log ${goal.metric_key ?? goal.title}`,
        body: target != null ? `Where you're aiming: ${fmt(target)}${unit}.` : 'Takes ten seconds.',
        subject: `${goal.title} — quick log`,
        eyebrow,
      }
    default:
      return {
        title: label,
        body: 'Tap to log it.',
        subject: `${label} — reminder`,
        eyebrow,
      }
  }
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100)
}
