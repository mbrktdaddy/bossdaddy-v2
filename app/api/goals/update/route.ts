import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rematerializeSchedule } from '@/lib/goals/sweep'
import { recomputeGoalStats } from '@/lib/goals/stats'

// Edits a goal's own fields: title, description, metric, and the target curve.
// Schedules are handled separately by /api/goals/schedule.
//
// A route handler rather than a Server Action because it redirects on success,
// and next/navigation's redirect() throw is swallowed by this project's Sentry
// instrumentation.
//
// WHY THIS TOUCHES OCCURRENCES: `goal_occurrences.target_value` is STAMPED at
// materialization time, deliberately — the number a dad was asked for on March
// 3rd must not change retroactively because he later moved his end date. So when
// the curve changes, future unresolved days are rebuilt and re-stamped while
// everything already resolved is left exactly as it was.

const FormSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().trim().min(1, 'Give it a name.').max(120),
  description: z.string().trim().max(2000).optional(),
  metricKey: z.string().trim().max(40).optional(),
  metricUnit: z.string().trim().max(20).optional(),
  direction: z.enum(['down', 'up', 'hold']).optional(),
  curve: z.enum(['none', 'linear', 'step']),
  baseline: z.string().trim().optional(),
  target: z.string().trim().optional(),
  weeks: z.string().trim().optional(),
  stepDays: z.string().trim().optional(),
  // Identity. Always editable and always clearable — the moment someone clears
  // it, every surface falls back to process language with no other switch to
  // flip. Caps match the CHECKs in migration 136.
  identityStatement: z.string().trim().max(160, 'Keep the identity line short — a phrase, not a paragraph.').optional(),
  identityShort: z.string().trim().max(24, 'The short version needs to fit in a list — 24 characters.').optional(),
})

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const raw = Object.fromEntries(form.entries())

  const parsed = FormSchema.safeParse(raw)
  if (!parsed.success) {
    const goalId = String(raw.goalId ?? '')
    return bounce(request, goalId, parsed.error.issues[0]?.message ?? 'That didn\'t look right.')
  }
  const input = parsed.data

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)

  const { data: existingRow } = await supabase
    .from('goals')
    .select('id, started_on, curve, baseline_value, target_value, step_every_days, target_date')
    .eq('id', input.goalId)
    .maybeSingle()
  const existing = existingRow as unknown as {
    id: string; started_on: string; curve: string
    baseline_value: number | null; target_value: number | null
    step_every_days: number | null; target_date: string | null
  } | null
  if (!existing) return NextResponse.redirect(new URL('/goals', request.url), 303)

  const baseline = num(input.baseline)
  const target = num(input.target)
  const weeks = num(input.weeks)
  const stepDays = num(input.stepDays)

  let curve = input.curve
  if (curve !== 'none' && (baseline == null || target == null || weeks == null)) {
    return bounce(request, input.goalId, 'Fill in the start number, the target, and how many weeks.')
  }
  if (curve === 'step' && (stepDays == null || stepDays < 1)) {
    return bounce(request, input.goalId, 'How many days between steps?')
  }
  if (curve !== 'none' && baseline === target) {
    // Equal endpoints make the curve meaningless; treat it as a flat target
    // rather than storing something that can't be interpolated.
    curve = 'none'
  }

  // Weeks are measured from the goal's ORIGINAL start, not from today — moving a
  // deadline shouldn't silently restart a taper someone is three weeks into.
  const targetDate = weeks != null ? addDays(existing.started_on, weeks * 7) : null

  const { error } = await supabase
    .from('goals')
    .update({
      title: input.title,
      description: emptyToNull(input.description),
      metric_key: emptyToNull(input.metricKey),
      metric_unit: emptyToNull(input.metricUnit),
      direction: input.direction ?? null,
      baseline_value: baseline,
      target_value: target,
      curve,
      step_every_days: curve === 'step' ? stepDays : null,
      target_date: targetDate,
      // ABSENT ≠ EMPTY. A form that submits '' is a deliberate clear; a caller
      // that omits the field entirely (a future partial-edit form, a script)
      // must not silently wipe an identity someone typed. An empty text input
      // still posts a key, so the distinction survives the round trip.
      ...(input.identityStatement !== undefined
        ? { identity_statement: emptyToNull(input.identityStatement) }
        : {}),
      ...(input.identityShort !== undefined
        ? { identity_short: emptyToNull(input.identityShort) }
        : {}),
    })
    .eq('id', input.goalId)
  if (error) {
    console.error('goals/update failed', error.message)
    return bounce(request, input.goalId, 'Couldn\'t save those changes.')
  }

  // Only rebuild when the curve actually moved. An edit that just fixes a typo in
  // the title has no business touching anyone's schedule.
  const curveChanged =
    curve !== existing.curve
    || baseline !== existing.baseline_value
    || target !== existing.target_value
    || (curve === 'step' ? stepDays : null) !== existing.step_every_days
    || targetDate !== existing.target_date

  if (curveChanged) {
    const admin = createAdminClient()
    const { data: scheduleRows } = await admin
      .from('goal_schedules')
      .select('id')
      .eq('goal_id', input.goalId)
    for (const row of (scheduleRows ?? []) as unknown as { id: string }[]) {
      await rematerializeSchedule(admin, row.id, new Date())
    }
  }

  await recomputeGoalStats(supabase, [input.goalId])
  return NextResponse.redirect(new URL(`/goals/${input.goalId}?saved=1`, request.url), 303)
}

function bounce(request: NextRequest, goalId: string, message: string): NextResponse {
  const url = new URL(goalId ? `/goals/${goalId}/edit` : '/goals', request.url)
  url.searchParams.set('msg', message)
  return NextResponse.redirect(url, 303)
}

function num(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function emptyToNull(value: string | undefined): string | null {
  return value == null || value.trim() === '' ? null : value.trim()
}

/** Calendar-date arithmetic — both sides parse as UTC midnight, so DST cancels. */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const ms = Date.UTC(y!, m! - 1, d!) + days * 86_400_000
  const out = new Date(ms)
  return `${out.getUTCFullYear()}-${String(out.getUTCMonth() + 1).padStart(2, '0')}-${String(out.getUTCDate()).padStart(2, '0')}`
}
