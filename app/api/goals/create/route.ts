import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertValidSchedule, isValidTimeZone, RecurrenceError } from '@/lib/goals/recurrence'
import { buildRrule, normalizeDays } from '@/lib/goals/schedule-input'
import { materializeScheduleById } from '@/lib/goals/sweep'

// Creates a goal plus its first schedule, then redirects to the goal.
//
// WHY A ROUTE HANDLER AND NOT A SERVER ACTION: this needs to redirect to the new
// goal's page on success, and next/navigation's redirect() throw is swallowed by
// this project's Sentry instrumentation. A NextResponse.redirect is a real
// Response object — nothing can intercept it. Same reasoning as /api/goals/tap.
//
// The form POSTs urlencoded, so this works with JavaScript disabled.

const FormSchema = z.object({
  kind: z.enum(['reduce', 'adherence', 'program', 'metric', 'custom']),
  title: z.string().trim().min(1, 'Give it a name.').max(120),
  metricKey: z.string().trim().max(40).optional(),
  metricUnit: z.string().trim().max(20).optional(),
  direction: z.enum(['down', 'up', 'hold']).optional(),
  curve: z.enum(['none', 'linear', 'step']),
  baseline: z.string().trim().optional(),
  target: z.string().trim().optional(),
  weeks: z.string().trim().optional(),
  stepDays: z.string().trim().optional(),
  when: z.enum(['daily', 'weekdays', 'days', 'monthly']),
  localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time.'),
  timezone: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})


export async function POST(request: NextRequest) {
  const form = await request.formData()
  const raw = Object.fromEntries(form.entries())
  const channels = form.getAll('channels').map(String).filter((c) => c === 'push' || c === 'email')

  const parsed = FormSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return bounce(request, String(raw.kind ?? ''), first?.message ?? 'Something in that form didn\'t look right.')
  }
  const input = parsed.data

  if (!isValidTimeZone(input.timezone)) {
    return bounce(request, input.kind, 'That timezone didn\'t look right.')
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals/new', request.url), 303)

  const days = normalizeDays(form.getAll('days').map(String))
  if (input.when === 'days' && days.length === 0) {
    return bounce(request, input.kind, 'Pick at least one day of the week.')
  }
  const rrule = buildRrule(input.when, input.startDate, days)

  // Validate through the engine's own gate before anything is written — a rule
  // that can't expand should fail on the user's screen, not in a 4 a.m. cron.
  try {
    assertValidSchedule({
      rrule,
      startDate: input.startDate,
      localTime: input.localTime,
      timezone: input.timezone,
    })
  } catch (err) {
    const message = err instanceof RecurrenceError ? err.message : 'That schedule didn\'t work out.'
    return bounce(request, input.kind, message)
  }

  // ── curve numbers ─────────────────────────────────────────────────────────
  const baseline = num(input.baseline)
  const target = num(input.target)
  const weeks = num(input.weeks)
  const stepDays = num(input.stepDays)

  // A curve needs both endpoints and an end date to interpolate between; fall
  // back to a flat goal rather than writing something that can't be evaluated.
  // (The DB CHECKs enforce this too — this keeps the message friendly.)
  let curve = input.curve
  if (curve !== 'none' && (baseline == null || target == null || weeks == null)) {
    if (input.kind === 'reduce' || input.kind === 'metric') {
      return bounce(request, input.kind, 'Fill in the starting number, the target, and how many weeks.')
    }
    curve = 'none'
  }
  if (curve === 'step' && (stepDays == null || stepDays < 1)) {
    return bounce(request, input.kind, 'How many days between steps?')
  }

  const targetDate = weeks != null ? addDays(input.startDate, weeks * 7) : null

  // ── write ─────────────────────────────────────────────────────────────────
  // Session client, so RLS is what ties these rows to the signed-in user.
  const { data: goalRow, error: goalError } = await supabase
    .from('goals')
    .insert({
      user_id: user.id,
      kind: input.kind,
      title: input.title,
      metric_key: emptyToNull(input.metricKey),
      metric_unit: emptyToNull(input.metricUnit),
      direction: input.direction ?? null,
      baseline_value: curve === 'none' ? baseline : baseline!,
      target_value: target,
      curve,
      step_every_days: curve === 'step' ? stepDays : null,
      started_on: input.startDate,
      target_date: targetDate,
    })
    .select('id')
    .single()

  if (goalError || !goalRow) {
    console.error('goals/create goal insert failed', goalError?.message)
    return bounce(request, input.kind, 'Couldn\'t save that goal. Try again.')
  }
  const goalId = (goalRow as unknown as { id: string }).id

  const { data: scheduleRow, error: scheduleError } = await supabase
    .from('goal_schedules')
    .insert({
      goal_id: goalId,
      user_id: user.id,
      label: null,
      rrule,
      start_date: input.startDate,
      local_time: input.localTime,
      timezone: input.timezone,
      channels: channels.length ? channels : ['push', 'email'],
    })
    .select('id')
    .single()

  if (scheduleError || !scheduleRow) {
    console.error('goals/create schedule insert failed', scheduleError?.message)
    // The goal exists but has no schedule — send them to it rather than
    // stranding them on the form. The detail page says "no schedule yet".
    return NextResponse.redirect(new URL(`/goals/${goalId}`, request.url), 303)
  }

  // Materialize immediately so the goal isn't blank until the next */15 tick.
  // Best-effort: the sweep would pick it up regardless, so a failure here costs
  // a few minutes, not correctness. Needs the admin client — occurrences have no
  // INSERT policy, precisely so a client can't manufacture its own history.
  try {
    await materializeScheduleById(
      createAdminClient(),
      (scheduleRow as unknown as { id: string }).id,
      new Date(),
    )
  } catch (err) {
    console.error('goals/create materialize failed', err instanceof Error ? err.message : String(err))
  }

  return NextResponse.redirect(new URL(`/goals/${goalId}`, request.url), 303)
}

function bounce(request: NextRequest, kind: string, message: string): NextResponse {
  const url = new URL('/goals/new', request.url)
  if (kind) url.searchParams.set('kind', kind)
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
