import { NextResponse, type NextRequest } from 'next/server'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { SavingsReminderEmail } from '@/emails/SavingsReminderEmail'
import { computeStats, fmtUsdWhole, cadenceUnitLabel, resolveGoalZone } from '@/lib/dad-tools/savings'
import { localDateInZone, parseLocalYMD } from '@/lib/dates'
import type {
  SavingsGoal,
  SavingsEntry,
  SavingsCadence,
} from '@/lib/dad-tools/savings'

export const maxDuration = 60

const GOAL_COLUMNS = 'id, owner_id, kid_profile_id, name, description, cadence, amount_per_cadence, start_date, target_amount, target_date, destination_mode, destination_url, destination_type, destination_label, reminder_enabled, reminder_cadence, reminder_hour_utc, status, completed_at, archived_at, timezone, created_at, updated_at'
const ENTRY_COLUMNS = 'id, goal_id, contributor_id, contributed_on, amount, kind, note, created_at'

// Hourly cron. For each active goal whose reminder_hour_utc matches the
// current UTC hour and whose reminder_cadence-due-today is satisfied, we
// fan out per-participant emails to anyone who hasn't logged a contribution
// in the current cadence period.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — savings-reminders refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const qSecret    = new URL(request.url).searchParams.get('secret')
  const isVercel   = authHeader === `Bearer ${secret}`
  const isManual   = qSecret === secret
  if (!isVercel && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const now = new Date()
  const currentHourUtc = now.getUTCHours()

  // Pull all candidate goals — active, reminders on, hour matches.
  // We filter cadence in app code because the cadence-due-today logic is
  // simpler to express in JS than as a SQL filter (especially for weekly
  // where we need ISO-week-of-start-date math).
  const { data: goalRows, error: goalErr } = await admin.from('savings_goals')
    .select(GOAL_COLUMNS)
    .eq('status', 'active')
    .eq('reminder_enabled', true)
    .eq('reminder_hour_utc', currentHourUtc)
  if (goalErr) {
    console.error('savings-reminders: load goals failed', goalErr.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const candidates = ((goalRows ?? []) as unknown as SavingsGoal[])
    .filter((g) => reminderDueToday(g, now))
  if (candidates.length === 0) {
    return NextResponse.json({ success: true, hour: currentHourUtc, goals: 0, sent: 0 })
  }

  // Batch-fetch entries + participants + profiles for all candidate goals.
  const goalIds = candidates.map((g) => g.id)
  const [{ data: entryRows }, { data: participantRows }] = await Promise.all([
    admin.from('savings_entries').select(ENTRY_COLUMNS).in('goal_id', goalIds),
    admin.from('savings_goal_participants')
      .select('goal_id, user_id, muted')
      .in('goal_id', goalIds),
  ])
  const entries = ((entryRows ?? []) as unknown as SavingsEntry[])
  type ParticipantRow = { goal_id: string; user_id: string; muted: boolean }
  const participants = ((participantRows ?? []) as unknown as ParticipantRow[])

  const allUserIds = Array.from(new Set(participants.map((p) => p.user_id)))
  type ProfileRow = { id: string; email: string | null }
  // profiles table doesn't expose email directly — pull via auth.users with
  // service role. We project just (id, email) so the join is lean.
  const { data: authUserList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  if (authUserList) {
    for (const u of authUserList.users) {
      if (allUserIds.includes(u.id) && u.email) emailById.set(u.id, u.email)
    }
  }
  void ({} as ProfileRow)  // type kept above for reference

  let sent = 0
  let skipped = 0

  for (const goal of candidates) {
    const goalEntries = entries.filter((e) => e.goal_id === goal.id)
    // Cron has no request, so no header zone — the goal's stored owner zone is
    // the only source, falling back to UTC. That fallback is the pre-152
    // behaviour, so a goal the backfill couldn't reach is no worse than before.
    const goalDayYmd = localDateInZone(now, resolveGoalZone(goal.timezone))
    const stats = computeStats(goal, goalEntries, parseLocalYMD(goalDayYmd))
    const goalParticipants = participants.filter((p) => p.goal_id === goal.id)
    const cadenceForUnit = (goal.cadence ?? goal.reminder_cadence) as SavingsCadence | 'off' | null
    const cadenceLabel = cadenceForUnit === 'daily' ? 'today'
      : cadenceForUnit === 'weekly' ? 'this week'
      : cadenceForUnit === 'monthly' ? 'this month'
      : 'now'

    // For each participant: send unless they've already logged a
    // contribution/catchup in the current cadence period.
    for (const p of goalParticipants) {
      if (p.muted) { skipped++; continue }   // participant silenced this goal
      const email = emailById.get(p.user_id)
      if (!email) { skipped++; continue }

      const alreadyLogged = hasContributionForCurrentPeriod(
        goalEntries, p.user_id, cadenceForUnit, goalDayYmd,
      )
      if (alreadyLogged) { skipped++; continue }

      const amountLabel = goal.amount_per_cadence != null
        ? fmtUsdWhole(Number(goal.amount_per_cadence))
        : 'a contribution'
      const goalUrl   = `${siteUrl}/tools/savings/${goal.id}`
      const manageUrl = `${siteUrl}/tools/savings/${goal.id}/edit`
      const streakLabel = (goal.cadence && stats.streak != null && stats.streak > 0)
        ? `${cadenceUnitLabel(goal.cadence, stats.streak)} streak`
        : null

      const result = await sendEmail({
        to: email,
        subject: `Time for ${amountLabel} toward ${goal.name}`,
        tag: 'savings_reminder',
        react: React.createElement(SavingsReminderEmail, {
          goalName:        goal.name,
          amountLabel,
          cadenceLabel,
          totalSavedLabel: fmtUsdWhole(stats.runningTotal),
          streakLabel,
          goalUrl,
          manageUrl,
          siteUrl,
        }),
      })
      if (result.ok) sent++; else skipped++
    }
  }

  return NextResponse.json({
    success: true,
    hour:   currentHourUtc,
    goals:  candidates.length,
    sent,
    skipped,
    sentAt: new Date().toISOString(),
  })
}

// Determines whether the goal's reminder should fire on `now`'s date.
//   daily   → always
//   weekly  → today's UTC day-of-week matches the goal's start_date day
//   monthly → today's UTC day-of-month matches the goal's start_date day
// Falls back to true if reminder_cadence is unset (treat as daily).
function reminderDueToday(goal: SavingsGoal, now: Date): boolean {
  const cad = goal.reminder_cadence ?? goal.cadence ?? 'daily'
  if (cad === 'off') return false
  if (cad === 'daily') return true

  const [y, m, d] = goal.start_date.split('-').map(Number)
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))

  if (cad === 'weekly') return now.getUTCDay() === start.getUTCDay()
  if (cad === 'monthly') return now.getUTCDate() === start.getUTCDate()
  return true
}

// True if this contributor has logged a contribution/catchup in the current
// cadence period (today / this ISO week / this calendar month).
// `todayYmd` is the goal owner's calendar day, NOT the server's. Entries store
// `contributed_on` as the BROWSER's local date; comparing that against a UTC
// `isoYmd(now)` meant that between 00:00 and 02:00 UTC — i.e. the previous
// evening in the Americas — a contribution logged minutes earlier didn't count
// and the nudge went out anyway. Audit finding #34, same root cause as #5.
function hasContributionForCurrentPeriod(
  entries: SavingsEntry[],
  contributorId: string,
  cadence: SavingsCadence | 'off' | null,
  todayYmd: string,
): boolean {
  if (cadence === 'off' || cadence == null) {
    // No cadence → don't filter by period; treat any entry today as logged
    return entries.some((e) =>
      e.contributor_id === contributorId
      && (e.kind === 'contribution' || e.kind === 'catchup')
      && e.contributed_on === todayYmd,
    )
  }
  // Both sides are projected into UTC-midnight space purely so the ISO-week and
  // month arithmetic has a common frame — the DAY each side names has already
  // been decided in the owner's zone.
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  const todayAsUtc = new Date(Date.UTC(ty ?? 1970, (tm ?? 1) - 1, td ?? 1))

  const periodMatches = (entryYmd: string): boolean => {
    const [ey, em, ed] = entryYmd.split('-').map(Number)
    const eDate = new Date(Date.UTC(ey, (em ?? 1) - 1, ed ?? 1))
    if (cadence === 'daily') {
      return entryYmd === todayYmd
    }
    if (cadence === 'weekly') {
      return isoWeekKey(eDate) === isoWeekKey(todayAsUtc)
    }
    return eDate.getUTCFullYear() === todayAsUtc.getUTCFullYear()
        && eDate.getUTCMonth()    === todayAsUtc.getUTCMonth()
  }
  return entries.some((e) =>
    e.contributor_id === contributorId
    && (e.kind === 'contribution' || e.kind === 'catchup')
    && periodMatches(e.contributed_on),
  )
}

// `isoYmd(now)` lived here and was the UTC half of finding #34 — deleted rather
// than left available, because the only remaining use for a UTC "today" in this
// file would be a reintroduction of the bug. Day keys come from
// localDateInZone(now, resolveGoalZone(goal.timezone)).

function isoWeekKey(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = dt.getUTCDay() || 7
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7)
  return `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
