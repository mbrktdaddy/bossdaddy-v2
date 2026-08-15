import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertValidSchedule, isValidTimeZone, localDateInZone, RecurrenceError } from '@/lib/goals/recurrence'
import { buildRrule, normalizeDays } from '@/lib/goals/schedule-input'
import { materializeScheduleById } from '@/lib/goals/sweep'
import { loadTemplate } from '@/lib/goals/templates'
import { revalidateGoal } from '@/lib/goals/revalidate'

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
  // The form's notion of "today" in the visitor's zone, so a future-only start
  // date can be enforced without the server guessing where he is.
  clientToday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Which template this came from. Looked up rather than trusted: the row is the
  // only source for `is_sensitive`, and a slug that no longer resolves is stored
  // as NULL instead of dangling.
  templateSlug: z.string().trim().max(80).optional(),
  // Identity. Optional at every layer — the caps match the CHECKs in migration
  // 136 so an over-long paste bounces with a sentence instead of a 500.
  identityStatement: z.string().trim().max(160, 'Keep the identity line short — a phrase, not a paragraph.').optional(),
  identityShort: z.string().trim().max(24, 'The short version needs to fit in a list — 24 characters.').optional(),
})


export async function POST(request: NextRequest) {
  const form = await request.formData()
  const raw = Object.fromEntries(form.entries())
  // 'inapp' writes into the shared notifications feed (mig 082) via the sweep.
  // It was missing from this filter, so even a hand-rolled POST couldn't set it.
  const channels = form.getAll('channels').map(String)
    .filter((c) => c === 'push' || c === 'email' || c === 'inapp')

  const parsed = FormSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return bounce(
      request,
      { template: String(raw.templateSlug ?? ''), kind: String(raw.kind ?? '') },
      first?.message ?? 'Something in that form didn\'t look right.',
    )
  }
  const input = { ...parsed.data }
  const origin = { template: input.templateSlug ?? '', kind: input.kind }

  if (!isValidTimeZone(input.timezone)) {
    return bounce(request, origin, 'That timezone didn\'t look right.')
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals/new', request.url), 303)

  // No backdating. The materializer would expand every day since, and the sweep
  // would age them all out to `missed` — a wall of failures on day one, which on
  // a cessation goal is exactly the evidence-against-the-identity this layer
  // exists to avoid. (Stale nudges aren't the risk; the sweep skips anything too
  // old to be one.) The form's `min` says the same thing; this is the gate.
  //
  // ⚠️ "TODAY" IS RECOMPUTED HERE, AT SUBMIT TIME. It used to trust `clientToday`,
  // a hidden field stamped when the FORM RENDERED — so both the default start date
  // and the check that validated it came from the same stale moment and happily
  // agreed with each other.
  //
  // Observed: a goal created at 00:02 local was dated to the previous day, because
  // the form had been open since 23:5x. Every plan then reads a day ahead of
  // itself — "Day 2" on the day you started — and the first occurrence materializes
  // for a date already gone.
  //
  // Clamped rather than rejected. A form that went stale across midnight is not a
  // user error, and "today or later" is satisfied by moving it to today: he asked
  // to start now and that's what he gets. A genuinely future date is left alone.
  const serverToday = localDateInZone(new Date(), input.timezone)
  if (input.startDate < serverToday) {
    input.startDate = serverToday
  }

  const days = normalizeDays(form.getAll('days').map(String))
  if (input.when === 'days' && days.length === 0) {
    return bounce(request, origin, 'Pick at least one day of the week.')
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
    return bounce(request, origin, message)
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
      return bounce(request, origin, 'Fill in the starting number, the target, and how many weeks.')
    }
    curve = 'none'
  }
  if (curve === 'step' && (stepDays == null || stepDays < 1)) {
    return bounce(request, origin, 'How many days between steps?')
  }

  const targetDate = weeks != null ? addDays(input.startDate, weeks * 7) : null

  // ── where it came from ────────────────────────────────────────────────────
  // The template row is the ONLY source for `is_sensitive` — it decides whether
  // this goal gets edge-off framing from the Boss and from the UI, so it can't
  // come from a form field a hand-rolled POST could flip. A slug that no longer
  // resolves is dropped rather than stored dangling.
  const template = input.templateSlug ? await loadTemplate(supabase, input.templateSlug) : null

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
      // Optional at every layer. Blank stays NULL rather than '' so "has he set
      // an identity?" is one null check everywhere downstream.
      identity_statement: emptyToNull(input.identityStatement),
      identity_short: emptyToNull(input.identityShort),
      template_slug: template?.slug ?? null,
      // `config` is this table's home for kind-specific extras (134), validated
      // here rather than by Postgres. Only written when true, so the key's
      // presence means something and an ordinary goal keeps an empty object.
      config: template?.isSensitive ? { sensitive: true } : {},
    })
    .select('id')
    .single()

  if (goalError || !goalRow) {
    console.error('goals/create goal insert failed', goalError?.message)
    return bounce(request, origin, 'Couldn\'t save that goal. Try again.')
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
    revalidateGoal(goalId)
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

  revalidateGoal(goalId)
  return NextResponse.redirect(new URL(`/goals/${goalId}`, request.url), 303)
}

/**
 * Back to the form he was on, with the reason.
 *
 * Prefers the template slug so the prefill survives the round trip; `kind` is the
 * fallback for a POST that predates templates, and /goals/new still resolves it
 * to that kind's default.
 */
function bounce(
  request: NextRequest,
  origin: { template: string; kind: string },
  message: string,
): NextResponse {
  const url = new URL('/goals/new', request.url)
  if (origin.template) url.searchParams.set('t', origin.template)
  else if (origin.kind) url.searchParams.set('kind', origin.kind)
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
