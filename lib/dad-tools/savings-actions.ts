'use server'

// Savings tool — Server Actions for goal CRUD + contribution logging.
//
// Authenticated-only. No anonymous path: persistence requires a stable
// identity (reminders, invites, multi-day streaks). Mirrors the kid-actions
// + moment-actions structure: Zod parse → SSR client write → revalidate.
//
// Invites + multi-participant flows live in this file too but are exercised
// via separate Phase-3 work. The participants table is populated on goal
// creation (owner auto-inserted) so the streak/RLS checks work day one.

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  SavingsGoal,
  SavingsEntry,
  SavingsParticipant,
  GoalStats,
} from './savings'
import { computeStats } from './savings'

export type SavingsActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

// ── Schemas ─────────────────────────────────────────────────────────────────

const CadenceSchema = z.enum(['daily', 'weekly', 'monthly'])
const ReminderCadenceSchema = z.enum(['daily', 'weekly', 'monthly', 'off'])
const DestinationModeSchema = z.enum(['shared', 'per_participant', 'manual'])
const DestinationTypeSchema = z.enum(['paypal', 'venmo', 'cashapp', 'zelle', 'manual'])

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/

// Base shape — no refines. `.partial()` on a refined schema is rejected by
// Zod v4, so the create and update schemas both derive from this base and
// add the cross-field refines themselves.
const GoalInputBaseSchema = z.object({
  name:               z.string().trim().min(1, 'Name is required').max(120),
  description:        z.string().trim().max(2000).optional().nullable(),
  kid_profile_id:     z.string().uuid().optional().nullable(),

  cadence:            CadenceSchema.optional().nullable(),
  amount_per_cadence: z.number().positive().max(1e7).optional().nullable(),
  start_date:         z.string().regex(YMD_RE).optional(),

  target_amount:      z.number().positive().max(1e9).optional().nullable(),
  target_date:        z.string().regex(YMD_RE).optional().nullable(),

  destination_mode:   DestinationModeSchema.optional(),
  destination_url:    z.string().trim().max(500)
    .refine(
      // Allow empty (no URL) OR a clear https/http URL OR a bare handle
      // (no scheme — auto-detected as PayPal/Venmo/Cash App later). Reject
      // anything that looks like a scheme but isn't http(s): blocks
      // javascript:, data:, file:, intent:, and other URI schemes that could
      // be invoked via window.location.href on Yes tap.
      (v) => !v || !v.includes(':') || /^https?:\/\//i.test(v),
      { message: 'Destination URL must be an https:// URL or a bare handle' },
    )
    .optional().nullable(),
  destination_type:   DestinationTypeSchema.optional().nullable(),
  destination_label:  z.string().trim().max(120).optional().nullable(),

  reminder_enabled:   z.boolean().optional(),
  reminder_cadence:   ReminderCadenceSchema.optional().nullable(),
  reminder_hour_utc:  z.number().int().min(0).max(23).optional().nullable(),
})

const GoalInputSchema = GoalInputBaseSchema
  .refine(
    (v) => (v.cadence == null) === (v.amount_per_cadence == null),
    { message: 'Cadence and amount per cadence must both be set or both omitted' },
  )
  .refine(
    (v) => v.destination_mode !== 'shared' || !!v.destination_url,
    { message: 'Shared destination requires a URL', path: ['destination_url'] },
  )

const UpdateGoalSchema = GoalInputBaseSchema.partial().extend({
  id: z.string().uuid(),
})
  .refine(
    // Cadence/amount pair invariant: if EITHER is being touched (sent as null
    // or as a value), BOTH must be sent in lockstep. `undefined` means "not
    // touching this field." Use `in` + explicit null check so `undefined`
    // doesn't get coerced to null via `== null` and silently pass the check.
    (v) => {
      const touchingCadence = 'cadence' in v && v.cadence !== undefined
      const touchingAmount  = 'amount_per_cadence' in v && v.amount_per_cadence !== undefined
      if (!touchingCadence && !touchingAmount) return true
      if (touchingCadence !== touchingAmount) return false
      // Both touched — both must be null or both must be non-null.
      return (v.cadence === null) === (v.amount_per_cadence === null)
    },
    { message: 'Cadence and amount per cadence must both be set or both cleared together' },
  )

const LogContributionSchema = z.object({
  goalId:        z.string().uuid(),
  amount:        z.number().min(0).max(1e7),
  contributedOn: z.string().regex(YMD_RE).optional(),
  kind:          z.enum(['contribution', 'catchup']).optional(),
  note:          z.string().trim().max(500).optional().nullable(),
})

const SkipDaySchema = z.object({
  goalId: z.string().uuid(),
  dayKey: z.string().regex(YMD_RE),
  note:   z.string().trim().max(500).optional().nullable(),
})

const CatchUpSchema = z.object({
  goalId: z.string().uuid(),
  days:   z.array(z.object({
    date:   z.string().regex(YMD_RE),
    amount: z.number().positive().max(1e7),
    note:   z.string().trim().max(500).optional().nullable(),
  })).min(1).max(60),
})

const WithdrawalSchema = z.object({
  goalId:        z.string().uuid(),
  amount:        z.number().positive().max(1e7),
  withdrawnOn:   z.string().regex(YMD_RE).optional(),
  note:          z.string().trim().max(500).optional().nullable(),
})

// Versatile balance adjustment — covers withdrawals, bonus deposits, gifts,
// corrections, and "set balance to actual" syncs. Direction explicit; amount
// always positive. The math layer treats both directions as outside the
// daily-ritual streak (see walkStreakAndBank in lib/dad-tools/savings.ts).
const AdjustmentSchema = z.object({
  goalId:     z.string().uuid(),
  direction:  z.enum(['credit', 'debit']),
  amount:     z.number().positive().max(1e7),
  occurredOn: z.string().regex(YMD_RE).optional(),
  note:       z.string().trim().max(500).optional().nullable(),
})

// ── Columns ─────────────────────────────────────────────────────────────────

const GOAL_COLUMNS = [
  'id', 'owner_id', 'kid_profile_id',
  'name', 'description',
  'cadence', 'amount_per_cadence', 'start_date',
  'target_amount', 'target_date',
  'destination_mode', 'destination_url', 'destination_type', 'destination_label',
  'reminder_enabled', 'reminder_cadence', 'reminder_hour_utc',
  'status', 'completed_at', 'archived_at',
  'created_at', 'updated_at',
].join(', ')

const ENTRY_COLUMNS = 'id, goal_id, contributor_id, contributed_on, amount, kind, note, created_at'
const PARTICIPANT_COLUMNS = 'id, goal_id, user_id, role, destination_url, destination_type, destination_label, joined_at'

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayYMD(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function revalidateSavingsSurfaces(goalId?: string) {
  revalidatePath('/tools/savings')
  if (goalId) revalidatePath(`/tools/savings/${goalId}`)
  revalidatePath('/dashboard')
  revalidatePath('/account/settings')
  revalidatePath('/tools')
}

// ── Goal CRUD ───────────────────────────────────────────────────────────────

export async function createGoal(
  input: z.input<typeof GoalInputSchema>,
): Promise<SavingsActionResult<{ id: string }>> {
  const parsed = GoalInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to create a savings goal' }

  // 10 active goals per user, per the plan. Excludes archived goals.
  const { count } = await supabase.from('savings_goals')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .neq('status', 'archived')
  if ((count ?? 0) >= 10) {
    return {
      ok: false,
      error: 'You have 10 active goals already. Archive one to create another.',
    }
  }

  const payload = {
    owner_id:           user.id,
    kid_profile_id:     parsed.data.kid_profile_id ?? null,
    name:               parsed.data.name,
    description:        parsed.data.description ?? null,
    cadence:            parsed.data.cadence ?? null,
    amount_per_cadence: parsed.data.amount_per_cadence ?? null,
    start_date:         parsed.data.start_date ?? todayYMD(),
    target_amount:      parsed.data.target_amount ?? null,
    target_date:        parsed.data.target_date ?? null,
    destination_mode:   parsed.data.destination_mode ?? 'per_participant',
    destination_url:    parsed.data.destination_url ?? null,
    destination_type:   parsed.data.destination_type ?? null,
    destination_label:  parsed.data.destination_label ?? null,
    reminder_enabled:   parsed.data.reminder_enabled ?? true,
    reminder_cadence:   parsed.data.reminder_cadence ?? parsed.data.cadence ?? null,
    reminder_hour_utc:  parsed.data.reminder_hour_utc ?? 13, // 8am ET default
  }

  const { data, error } = await supabase.from('savings_goals')
    .insert(payload)
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  const goalId = data.id as string

  // Insert the owner as a participant. Use the admin client so the insert
  // bypasses RLS — the policy allows it, but the policy depends on the goal
  // row already existing AND on RLS catalog visibility, which can race with
  // INSERT RETURNING. Service role is the safe choice for this one-shot.
  const admin = createAdminClient()
  const { error: pErr } = await admin.from('savings_goal_participants')
    .insert({ goal_id: goalId, user_id: user.id, role: 'owner' })

  if (pErr) {
    // Compensating delete — don't leave an orphaned goal that the owner
    // can't see (their RLS read requires a participant row).
    await admin.from('savings_goals').delete().eq('id', goalId)
    return { ok: false, error: `Failed to register goal owner: ${pErr.message}` }
  }

  revalidateSavingsSurfaces(goalId)
  return { ok: true, data: { id: goalId } }
}

export async function updateGoal(
  input: z.input<typeof UpdateGoalSchema>,
): Promise<SavingsActionResult> {
  const parsed = UpdateGoalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { id, ...rest } = parsed.data
  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) updates[k] = v
  }
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  // Zod validated the field set; the typed client can't statically verify
  // dynamic keys, so cast through `never` to accept the partial payload.
  const { error } = await supabase.from('savings_goals')
    .update(updates as never)
    .eq('id', id)
    .eq('owner_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces(id)
  return { ok: true }
}

async function setGoalStatus(
  id: string,
  status: 'active' | 'paused' | 'completed' | 'archived',
): Promise<SavingsActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const patch: Record<string, unknown> = { status }
  if (status === 'archived') patch.archived_at = new Date().toISOString()
  if (status === 'completed') patch.completed_at = new Date().toISOString()

  const { error } = await supabase.from('savings_goals')
    .update(patch as never)
    .eq('id', parsed.data)
    .eq('owner_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces(parsed.data)
  return { ok: true }
}

export async function archiveGoal(id: string)  { return setGoalStatus(id, 'archived') }
export async function pauseGoal(id: string)    { return setGoalStatus(id, 'paused') }
export async function resumeGoal(id: string)   { return setGoalStatus(id, 'active') }

// Hard delete — permanently removes the goal and (via ON DELETE CASCADE in
// migration 078) every related row: participants, invitations, and all
// contribution/withdrawal/adjustment history. Irreversible. Owner-only.
//
// Use archiveGoal for soft delete when you want to preserve history.
export async function deleteGoal(id: string): Promise<SavingsActionResult> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { error } = await supabase.from('savings_goals')
    .delete()
    .eq('id', parsed.data)
    .eq('owner_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces()
  return { ok: true }
}

// ── Goal reads ──────────────────────────────────────────────────────────────

export interface GoalWithStats {
  goal:          SavingsGoal
  entries:       SavingsEntry[]
  participants:  SavingsParticipant[]
  stats:         GoalStats
}

export async function getGoals(
  options: { includeArchived?: boolean } = {},
): Promise<GoalWithStats[]> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return []

  // RLS handles the participant filter — we get owned goals + invited goals.
  let goalsQuery = supabase.from('savings_goals')
    .select(GOAL_COLUMNS)
    .order('created_at', { ascending: false })

  if (!options.includeArchived) {
    goalsQuery = goalsQuery.neq('status', 'archived')
  }

  const { data: goalRows } = await goalsQuery
  const goals = ((goalRows ?? []) as unknown as SavingsGoal[])
  if (goals.length === 0) return []

  const goalIds = goals.map((g) => g.id)

  const [{ data: entryRows }, { data: participantRows }] = await Promise.all([
    supabase.from('savings_entries').select(ENTRY_COLUMNS).in('goal_id', goalIds),
    supabase.from('savings_goal_participants').select(PARTICIPANT_COLUMNS).in('goal_id', goalIds),
  ])
  const entries = ((entryRows ?? []) as unknown as SavingsEntry[])
  const participants = ((participantRows ?? []) as unknown as SavingsParticipant[])

  return goals.map((goal) => {
    const goalEntries = entries.filter((e) => e.goal_id === goal.id)
    const goalParticipants = participants.filter((p) => p.goal_id === goal.id)
    return {
      goal,
      entries: goalEntries,
      participants: goalParticipants,
      stats: computeStats(goal, goalEntries),
    }
  })
}

export async function getGoal(id: string): Promise<GoalWithStats | null> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return null

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return null

  const { data: goalRow } = await supabase.from('savings_goals')
    .select(GOAL_COLUMNS)
    .eq('id', parsed.data)
    .maybeSingle()
  if (!goalRow) return null
  const goal = (goalRow as unknown as SavingsGoal)

  const [{ data: entryRows }, { data: participantRows }] = await Promise.all([
    supabase.from('savings_entries').select(ENTRY_COLUMNS).eq('goal_id', goal.id)
      .order('contributed_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('savings_goal_participants').select(PARTICIPANT_COLUMNS).eq('goal_id', goal.id),
  ])
  const entries = ((entryRows ?? []) as unknown as SavingsEntry[])
  const participants = ((participantRows ?? []) as unknown as SavingsParticipant[])

  return {
    goal,
    entries,
    participants,
    stats: computeStats(goal, entries),
  }
}

// ── Contribution / skip / catch-up ──────────────────────────────────────────

export async function logContribution(
  input: z.input<typeof LogContributionSchema>,
): Promise<SavingsActionResult<{ id: string; entry: SavingsEntry }>> {
  const parsed = LogContributionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to log a contribution' }

  const payload = {
    goal_id:        parsed.data.goalId,
    contributor_id: user.id,
    contributed_on: parsed.data.contributedOn ?? todayYMD(),
    amount:         parsed.data.amount,
    kind:           parsed.data.kind ?? 'contribution',
    note:           parsed.data.note ?? null,
  }

  const { data, error } = await supabase.from('savings_entries')
    .insert(payload)
    .select(ENTRY_COLUMNS)
    .single()
  if (error) return { ok: false, error: error.message }

  // If logging this contribution completes the goal, flip status. Best-effort:
  // a failure to mark completion isn't worth rolling back the contribution.
  await maybeMarkComplete(parsed.data.goalId)

  revalidateSavingsSurfaces(parsed.data.goalId)
  const entry = data as unknown as SavingsEntry
  return {
    ok: true,
    data: { id: entry.id, entry },
  }
}

export async function skipDay(
  input: z.input<typeof SkipDaySchema>,
): Promise<SavingsActionResult<{ id: string }>> {
  const parsed = SkipDaySchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { data, error } = await supabase.from('savings_entries')
    .insert({
      goal_id:        parsed.data.goalId,
      contributor_id: user.id,
      contributed_on: parsed.data.dayKey,
      amount:         0,
      kind:           'skip',
      note:           parsed.data.note ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true, data: { id: (data as { id: string }).id } }
}

// Versatile balance adjustment — replaces the single-direction "withdrawal"
// flow with credit (money in) or debit (money out). Use this for bonuses,
// gifts, corrections, syncs-to-actual, and emergency withdrawals.
export async function logAdjustment(
  input: z.input<typeof AdjustmentSchema>,
): Promise<SavingsActionResult<{ id: string }>> {
  const parsed = AdjustmentSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to log an adjustment' }

  const kind = parsed.data.direction === 'credit' ? 'adjustment_credit' : 'adjustment_debit'

  const { data, error } = await supabase.from('savings_entries')
    .insert({
      goal_id:        parsed.data.goalId,
      contributor_id: user.id,
      contributed_on: parsed.data.occurredOn ?? todayYMD(),
      amount:         parsed.data.amount,
      kind,
      note:           parsed.data.note ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  // Credit can flip a goal to completed; debit can knock it back to active.
  // Run both helpers — they no-op when the status is already correct.
  await maybeMarkComplete(parsed.data.goalId)
  await maybeRevertComplete(parsed.data.goalId)

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true, data: { id: (data as { id: string }).id } }
}

// Legacy: withdrawals are real-world emergencies, not part of the daily-
// ritual loop. Preserved for any callers still using the older shape; new
// UI should call logAdjustment with direction='debit' instead.
export async function logWithdrawal(
  input: z.input<typeof WithdrawalSchema>,
): Promise<SavingsActionResult<{ id: string }>> {
  const parsed = WithdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to log a withdrawal' }

  const { data, error } = await supabase.from('savings_entries')
    .insert({
      goal_id:        parsed.data.goalId,
      contributor_id: user.id,
      contributed_on: parsed.data.withdrawnOn ?? todayYMD(),
      amount:         parsed.data.amount,
      kind:           'withdrawal',
      note:           parsed.data.note ?? null,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  // A withdrawal can un-complete a goal that was previously at target. Best-
  // effort revert; the user can complete it again with future contributions.
  await maybeRevertComplete(parsed.data.goalId)

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function catchUp(
  input: z.input<typeof CatchUpSchema>,
): Promise<SavingsActionResult> {
  const parsed = CatchUpSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const rows = parsed.data.days.map((d) => ({
    goal_id:        parsed.data.goalId,
    contributor_id: user.id,
    contributed_on: d.date,
    amount:         d.amount,
    kind:           'catchup' as const,
    note:           d.note ?? null,
  }))

  const { error } = await supabase.from('savings_entries').insert(rows)
  if (error) return { ok: false, error: error.message }

  await maybeMarkComplete(parsed.data.goalId)

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true }
}

// Net total across all entries: contributions + catchups - withdrawals.
// Skips contribute 0. Mirrors runningTotal() in lib/dad-tools/savings.ts.
async function netTotal(goalId: string): Promise<number> {
  const supabase = await createClient()
  const { data: entries } = await supabase.from('savings_entries')
    .select('amount, kind')
    .eq('goal_id', goalId)
  let total = 0
  for (const e of (entries ?? []) as { amount: number; kind: string }[]) {
    const amt = Number(e.amount) || 0
    if (e.kind === 'contribution' || e.kind === 'catchup') total += amt
    else if (e.kind === 'withdrawal') total -= amt
  }
  return total
}

// Flips status to 'completed' when either target_amount has been reached OR
// target_date has passed (date-only goals complete on the deadline). Used by
// the contribution + catch-up flows. Best-effort — failure here never blocks
// the calling action.
async function maybeMarkComplete(goalId: string): Promise<void> {
  const supabase = await createClient()
  const { data: goal } = await supabase.from('savings_goals')
    .select('target_amount, target_date, status')
    .eq('id', goalId)
    .maybeSingle()
  if (!goal) return
  if (goal.status === 'completed' || goal.status === 'archived') return
  if (goal.target_amount == null && goal.target_date == null) return

  let shouldComplete = false
  if (goal.target_amount != null) {
    const total = await netTotal(goalId)
    if (total >= Number(goal.target_amount)) shouldComplete = true
  }
  if (!shouldComplete && goal.target_date != null) {
    if (new Date() > new Date(goal.target_date + 'T00:00:00')) shouldComplete = true
  }
  if (shouldComplete) {
    await supabase.from('savings_goals')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', goalId)
  }
}

// Undo a just-logged entry — the "I didn't actually do it" escape hatch on
// the Yes confirmation toast. Verifies caller is the contributor; RLS
// policy on savings_entries (migration 080) requires the deleter to STILL
// be a participant of the goal. The maybeRevert/maybeMark calls handle the
// case where this entry was the one that flipped (or unflipped) completion.
const DeleteEntrySchema = z.object({
  id: z.string().uuid(),
})

export async function deleteEntry(
  input: z.input<typeof DeleteEntrySchema>,
): Promise<SavingsActionResult> {
  const parsed = DeleteEntrySchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Fetch first to learn the goal_id — we need it for the revalidate path
  // and the post-delete status sync.
  const { data: row } = await supabase.from('savings_entries')
    .select('goal_id')
    .eq('id', parsed.data.id)
    .eq('contributor_id', user.id)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Entry not found' }
  const goalId = (row as { goal_id: string }).goal_id

  const { error } = await supabase.from('savings_entries')
    .delete()
    .eq('id', parsed.data.id)
    .eq('contributor_id', user.id)
  if (error) return { ok: false, error: error.message }

  // The removed entry might have just completed (a contribution) or just
  // uncompleted (a withdrawal) the goal. Run both helpers — they no-op when
  // the status is already correct.
  await maybeRevertComplete(goalId)
  await maybeMarkComplete(goalId)

  revalidateSavingsSurfaces(goalId)
  return { ok: true }
}

// Mirrors maybeMarkComplete but in reverse: a withdrawal can drop net total
// back below target, so a previously-completed goal becomes active again.
// Best-effort; never blocks the calling action.
async function maybeRevertComplete(goalId: string): Promise<void> {
  const supabase = await createClient()
  const { data: goal } = await supabase.from('savings_goals')
    .select('target_amount, status')
    .eq('id', goalId)
    .maybeSingle()
  if (!goal || goal.target_amount == null) return
  if (goal.status !== 'completed') return

  const total = await netTotal(goalId)
  if (total < Number(goal.target_amount)) {
    await supabase.from('savings_goals')
      .update({ status: 'active', completed_at: null })
      .eq('id', goalId)
  }
}

// ── Multi-participant invites (Phase 3) ─────────────────────────────────────
//
// Invite flow:
//   1. Owner calls createInvite → generates token, stores invitation row
//   2. Owner shares the link /tools/savings/invite/{token} (copy/text/email)
//   3. Recipient opens link → signs in/up if needed → calls acceptInvite
//   4. acceptInvite validates token + max-5 cap + inserts participant row
//   5. Recipient is now a contributor; goal_id RLS opens up to them
//
// Tokens are 24-byte (192-bit) base64url strings — collision-resistant and
// URL-safe. 7-day expiry. Single-use (used_at + used_by stamp on accept).

const MAX_PARTICIPANTS = 5
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000   // 7 days

const CreateInviteSchema = z.object({
  goalId: z.string().uuid(),
  email:  z.string().trim().email().max(200).optional().nullable(),
})

function newInviteToken(): string {
  return randomBytes(24).toString('base64url')
}

// Total goal participants + pending (unused, unexpired) invites. The cap is
// enforced against this combined count so an owner can't keep generating
// invites past 5.
async function countCommittedSpots(
  admin: ReturnType<typeof createAdminClient>,
  goalId: string,
): Promise<number> {
  const nowIso = new Date().toISOString()
  const [{ count: participantCount }, { count: pendingCount }] = await Promise.all([
    admin.from('savings_goal_participants')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId),
    admin.from('savings_goal_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId)
      .is('used_at', null)
      .gt('expires_at', nowIso),
  ])
  return (participantCount ?? 0) + (pendingCount ?? 0)
}

export async function createInvite(
  input: z.input<typeof CreateInviteSchema>,
): Promise<SavingsActionResult<{ token: string; url: string; id: string }>> {
  const parsed = CreateInviteSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to send invites' }

  // Owner-only — verify by reading through the SSR client (RLS-bound).
  const { data: goal } = await supabase.from('savings_goals')
    .select('id, owner_id, status')
    .eq('id', parsed.data.goalId)
    .maybeSingle()
  if (!goal) return { ok: false, error: 'Goal not found' }
  if ((goal as { owner_id: string }).owner_id !== user.id) {
    return { ok: false, error: 'Only the goal owner can send invites' }
  }
  if ((goal as { status: string }).status === 'archived') {
    return { ok: false, error: 'Cannot invite to an archived goal' }
  }

  const admin = createAdminClient()
  const used = await countCommittedSpots(admin, parsed.data.goalId)
  if (used >= MAX_PARTICIPANTS) {
    return {
      ok: false,
      error: `This goal is full (${MAX_PARTICIPANTS} participants/invites). Remove someone first.`,
    }
  }

  const token = newInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { data, error } = await admin.from('savings_goal_invitations')
    .insert({
      goal_id:    parsed.data.goalId,
      inviter_id: user.id,
      token,
      email:      parsed.data.email ?? null,
      expires_at: expiresAt,
    })
    .select('id')
    .single()
  if (error) return { ok: false, error: error.message }

  // Build the invite URL from the CURRENT request's host (not the env var
  // NEXT_PUBLIC_SITE_URL, which points to production and breaks dev testing).
  // Falls back to NEXT_PUBLIC_SITE_URL when running outside a request context.
  const reqHeaders = await headers()
  const host = reqHeaders.get('host')
  const proto = reqHeaders.get('x-forwarded-proto') ?? (host?.startsWith('localhost') || host?.startsWith('127.') ? 'http' : 'https')
  const siteUrl = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL ?? '')
  const url = `${siteUrl}/tools/savings/invite/${token}`

  revalidatePath(`/tools/savings/${parsed.data.goalId}/invite`)
  revalidatePath(`/tools/savings/${parsed.data.goalId}`)
  return { ok: true, data: { token, url, id: (data as { id: string }).id } }
}

// Owner revokes a pending invite — deletes the row outright. Used + expired
// rows are kept for the audit trail (could be cleaned up by a future cron).
export async function revokeInvite(inviteId: string): Promise<SavingsActionResult> {
  const parsed = z.string().uuid().safeParse(inviteId)
  if (!parsed.success) return { ok: false, error: 'Invalid id' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  // Read via SSR client — RLS lets owner+inviter see; non-owners can't.
  const { data: invite } = await supabase.from('savings_goal_invitations')
    .select('goal_id, inviter_id, used_at')
    .eq('id', parsed.data)
    .maybeSingle()
  if (!invite) return { ok: false, error: 'Invite not found' }
  if ((invite as { used_at: string | null }).used_at != null) {
    return { ok: false, error: 'Invite already accepted — remove the participant instead' }
  }

  const goalId = (invite as { goal_id: string }).goal_id

  // Goal-owner-or-inviter can revoke. The admin client bypasses RLS on the
  // delete so we don't need a per-role policy for it.
  const { data: goal } = await supabase.from('savings_goals')
    .select('owner_id')
    .eq('id', goalId)
    .maybeSingle()
  const isOwner = (goal as { owner_id: string } | null)?.owner_id === user.id
  const isInviter = (invite as { inviter_id: string }).inviter_id === user.id
  if (!isOwner && !isInviter) {
    return { ok: false, error: 'Only the goal owner or the inviter can revoke this' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('savings_goal_invitations')
    .delete()
    .eq('id', parsed.data)
  if (error) return { ok: false, error: error.message }

  revalidatePath(`/tools/savings/${goalId}/invite`)
  revalidatePath(`/tools/savings/${goalId}`)
  return { ok: true }
}

// Recipient accepts an invite. Token comes from the URL; recipient must be
// authenticated by this point (the public accept page bounces logged-out
// visitors to /login with a next= param). All writes go through the admin
// client because:
//   - The recipient can't read the invitation row via RLS (only owner/inviter)
//   - The participant insert is gated by the goal owner's policy
const AcceptInviteSchema = z.object({
  token: z.string().min(8).max(200),
})

export async function acceptInvite(
  input: z.input<typeof AcceptInviteSchema>,
): Promise<SavingsActionResult<{ goalId: string }>> {
  const parsed = AcceptInviteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid invite' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Sign in to accept this invite' }

  const admin = createAdminClient()

  const { data: invite } = await admin.from('savings_goal_invitations')
    .select('id, goal_id, expires_at, used_at')
    .eq('token', parsed.data.token)
    .maybeSingle()

  type InviteRow = { id: string; goal_id: string; expires_at: string; used_at: string | null }
  const inviteRow = invite as InviteRow | null
  if (!inviteRow) return { ok: false, error: 'This invite link is invalid or has been revoked' }
  if (inviteRow.used_at != null) return { ok: false, error: 'This invite has already been used' }
  if (new Date(inviteRow.expires_at) < new Date()) return { ok: false, error: 'This invite has expired — ask the owner for a new one' }

  const goalId = inviteRow.goal_id

  // Verify the goal is still active enough to join
  const { data: goal } = await admin.from('savings_goals')
    .select('id, owner_id, status')
    .eq('id', goalId)
    .maybeSingle()
  type GoalRow = { id: string; owner_id: string; status: string }
  const goalRow = goal as GoalRow | null
  if (!goalRow) return { ok: false, error: 'This goal no longer exists' }
  if (goalRow.status === 'archived') return { ok: false, error: 'This goal has been archived' }

  // Already a participant? Treat as success — surface the goalId so the UI
  // can redirect them in.
  const { data: existing } = await admin.from('savings_goal_participants')
    .select('id')
    .eq('goal_id', goalId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing) {
    // Mark the invite as used by this recipient so it can't be reused.
    await admin.from('savings_goal_invitations')
      .update({ used_at: new Date().toISOString(), used_by: user.id })
      .eq('id', inviteRow.id)
    return { ok: true, data: { goalId } }
  }

  // Max-5 cap — count actual participants (not pending invites — they don't
  // occupy a real seat until accepted).
  const { count: participantCount } = await admin.from('savings_goal_participants')
    .select('id', { count: 'exact', head: true })
    .eq('goal_id', goalId)
  if ((participantCount ?? 0) >= MAX_PARTICIPANTS) {
    return { ok: false, error: 'This goal is full — ask the owner to remove someone first' }
  }

  // Two-step atomic-ish: insert the participant, then mark the invite used.
  // If the participant insert fails, we don't mark the invite used (it can be
  // retried). If the mark-used fails after participant insert succeeds, the
  // user is still in the goal — the invite is just left as "used by them" by
  // the next attempt's existing-participant branch above.
  const { error: insertError } = await admin.from('savings_goal_participants')
    .insert({ goal_id: goalId, user_id: user.id, role: 'contributor' })
  if (insertError) return { ok: false, error: insertError.message }

  await admin.from('savings_goal_invitations')
    .update({ used_at: new Date().toISOString(), used_by: user.id })
    .eq('id', inviteRow.id)

  revalidatePath(`/tools/savings/${goalId}`)
  revalidatePath(`/tools/savings/${goalId}/invite`)
  revalidatePath('/tools/savings')
  revalidatePath('/account/settings')
  revalidatePath('/dashboard/profile')
  return { ok: true, data: { goalId } }
}

// Remove a participant from a goal. Owner can remove anyone except themselves
// (owners must delete or archive the goal instead). A non-owner participant
// can leave the goal by removing themselves.
const RemoveParticipantSchema = z.object({
  goalId: z.string().uuid(),
  userId: z.string().uuid(),
})

export async function removeParticipant(
  input: z.input<typeof RemoveParticipantSchema>,
): Promise<SavingsActionResult> {
  const parsed = RemoveParticipantSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input' }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const { data: goal } = await supabase.from('savings_goals')
    .select('owner_id')
    .eq('id', parsed.data.goalId)
    .maybeSingle()
  if (!goal) return { ok: false, error: 'Goal not found' }
  const ownerId = (goal as { owner_id: string }).owner_id

  const removingSelf = parsed.data.userId === user.id
  const callerIsOwner = ownerId === user.id

  if (!removingSelf && !callerIsOwner) {
    return { ok: false, error: 'Only the goal owner can remove participants' }
  }
  if (removingSelf && callerIsOwner) {
    return { ok: false, error: 'Owners can\'t leave their own goal — archive or delete it instead' }
  }
  if (!removingSelf && parsed.data.userId === ownerId) {
    return { ok: false, error: 'Can\'t remove the goal owner' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('savings_goal_participants')
    .delete()
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', parsed.data.userId)
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true }
}

// Update the current user's own participant row — used for changing their
// per-participant destination when the goal is in per_participant mode.
const UpdateParticipantDestinationSchema = z.object({
  goalId:            z.string().uuid(),
  destination_url:   z.string().trim().max(500).optional().nullable(),
  destination_type:  DestinationTypeSchema.optional().nullable(),
  destination_label: z.string().trim().max(120).optional().nullable(),
})

export async function updateParticipantDestination(
  input: z.input<typeof UpdateParticipantDestinationSchema>,
): Promise<SavingsActionResult> {
  const parsed = UpdateParticipantDestinationSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { ok: false, error: 'Unauthorized' }

  const updates: Record<string, unknown> = {}
  if (parsed.data.destination_url   !== undefined) updates.destination_url   = parsed.data.destination_url
  if (parsed.data.destination_type  !== undefined) updates.destination_type  = parsed.data.destination_type
  if (parsed.data.destination_label !== undefined) updates.destination_label = parsed.data.destination_label
  if (Object.keys(updates).length === 0) {
    return { ok: false, error: 'No fields to update' }
  }

  const { error } = await supabase.from('savings_goal_participants')
    .update(updates as never)
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: error.message }

  revalidateSavingsSurfaces(parsed.data.goalId)
  return { ok: true }
}
