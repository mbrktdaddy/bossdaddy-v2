import { NextResponse, type NextRequest } from 'next/server'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { SavingsSpouseNudgeEmail } from '@/emails/SavingsSpouseNudgeEmail'
import { runningTotal, fmtUsdWhole } from '@/lib/dad-tools/savings'
import type { SavingsEntry, SavingsGoal } from '@/lib/dad-tools/savings'

export const maxDuration = 60

// End-of-day daily-cadence nudge. Frames as teamwork — "no one has logged
// today on [Goal] yet; want to cover it?" — sent only when the goal has
// MULTIPLE participants AND has 0 contributions/catchups for the current
// UTC day. Skips solo goals (no spouse to nudge), weekly/monthly cadences
// (less urgent), and goals where the daily quota is already met.
//
// Triggered by Vercel Cron once a day; UTC schedule decided per vercel.json.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — spouse-nudge refusing to run')
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

  // Pull active daily-cadence goals with reminders on
  const { data: goalRows } = await admin.from('savings_goals')
    .select('id, name, cadence, amount_per_cadence, reminder_enabled, status, owner_id, start_date')
    .eq('status', 'active')
    .eq('reminder_enabled', true)
    .eq('cadence', 'daily')

  type GoalMini = Pick<SavingsGoal,
    'id' | 'name' | 'cadence' | 'amount_per_cadence' | 'reminder_enabled' | 'status' | 'owner_id' | 'start_date'
  >
  const goals = ((goalRows ?? []) as unknown as GoalMini[])
  if (goals.length === 0) {
    return NextResponse.json({ success: true, goals: 0, sent: 0 })
  }

  const goalIds = goals.map((g) => g.id)
  const today = isoYmd(new Date())

  // Fetch today's entries + all participants in parallel
  const [{ data: entryRows }, { data: participantRows }] = await Promise.all([
    admin.from('savings_entries')
      .select('id, goal_id, contributor_id, contributed_on, amount, kind, note, created_at')
      .in('goal_id', goalIds)
      .eq('contributed_on', today),
    admin.from('savings_goal_participants')
      .select('goal_id, user_id, muted')
      .in('goal_id', goalIds),
  ])
  type EntryRow = SavingsEntry
  type ParticipantRow = { goal_id: string; user_id: string; muted: boolean }
  const todayEntries = ((entryRows ?? []) as unknown as EntryRow[])
  const participants = ((participantRows ?? []) as unknown as ParticipantRow[])

  // Email + display-name lookups via auth.users + profiles
  const allUserIds = Array.from(new Set(participants.map((p) => p.user_id)))
  const { data: authUserList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>()
  if (authUserList) {
    for (const u of authUserList.users) {
      if (allUserIds.includes(u.id) && u.email) emailById.set(u.id, u.email)
    }
  }

  type ProfileRow = { id: string; username: string | null; display_name: string | null }
  const { data: profileRows } = await admin.from('profiles')
    .select('id, username, display_name')
    .in('id', allUserIds)
  const nameById = new Map<string, string>()
  for (const p of ((profileRows ?? []) as ProfileRow[])) {
    const n = p.display_name?.trim() || (p.username ? `@${p.username}` : 'Your partner')
    nameById.set(p.id, n)
  }

  // Pull running totals for nudge body — need full entries to compute.
  const { data: allEntryRows } = await admin.from('savings_entries')
    .select('id, goal_id, contributor_id, contributed_on, amount, kind, note, created_at')
    .in('goal_id', goalIds)
  const allEntries = ((allEntryRows ?? []) as unknown as EntryRow[])

  let sent = 0
  let skipped = 0
  let goalsConsidered = 0

  for (const goal of goals) {
    const goalParticipants = participants.filter((p) => p.goal_id === goal.id)
    if (goalParticipants.length < 2) { skipped++; continue }   // solo — skip
    goalsConsidered++

    // Today's contribution-or-catchup count from anyone
    const todayContribs = todayEntries.filter((e) =>
      e.goal_id === goal.id && (e.kind === 'contribution' || e.kind === 'catchup'),
    )
    if (todayContribs.length > 0) { skipped++; continue }   // already covered

    // The cadence amount must exist for a daily-cadence goal (DB invariant).
    const amount = Number(goal.amount_per_cadence ?? 0)
    const amountLabel = fmtUsdWhole(amount)
    const goalEntries = allEntries.filter((e) => e.goal_id === goal.id)
    const totalSavedLabel = fmtUsdWhole(runningTotal(goalEntries))
    const goalUrl   = `${siteUrl}/tools/savings/${goal.id}`
    const manageUrl = `${siteUrl}/tools/savings/${goal.id}/edit`

    // Send to every participant — each one frames the OTHER participant(s)
    // as the "partner who hasn't logged."
    for (const p of goalParticipants) {
      if (p.muted) { skipped++; continue }   // participant silenced this goal
      const email = emailById.get(p.user_id)
      if (!email) { skipped++; continue }
      const otherIds = goalParticipants
        .filter((q) => q.user_id !== p.user_id)
        .map((q) => q.user_id)
      const otherNames = otherIds.map((id) => nameById.get(id) ?? 'Your partner')
      const partnerName = otherNames.length === 1
        ? otherNames[0]
        : otherNames.slice(0, -1).join(', ') + ' and ' + otherNames[otherNames.length - 1]

      const result = await sendEmail({
        to: email,
        subject: `${partnerName} hasn't logged for ${goal.name} today`,
        tag: 'savings_spouse_nudge',
        react: React.createElement(SavingsSpouseNudgeEmail, {
          goalName: goal.name,
          amountLabel,
          partnerName,
          totalSavedLabel,
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
    goals:           goals.length,
    goalsConsidered,
    sent,
    skipped,
    sentAt:          new Date().toISOString(),
  })
}

function isoYmd(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
