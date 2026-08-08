// Goal templates — the one prefill path for /goals/new.
//
// A template is a PRE-FILLED CREATE-FORM PAYLOAD plus the copy that sells it and
// a pre-written identity suggestion. Rows live in `goal_templates` (migration
// 136) so an operator can reword a plan without a deploy, and the five generic
// `kind` shapes are rows too — flagged `is_kind_default` — because two prefill
// mechanisms would have meant a taper's defaults living in two places. The const
// that used to hold them in app/(tools)/goals/new is gone.
//
// WHY EVERY ROW IS RE-VALIDATED HERE
// The table's CHECKs mirror the create route's Zod schema, so a bad row should be
// impossible. "Should be impossible" is how the seed and the form drift apart
// eighteen months from now, and the failure mode is ugly: a template that renders
// fine, then bounces the user with a friendly message about a field they can't
// see. So the reader parses each row and DROPS the ones it can't use, loudly in
// the server log and silently on screen. A shelf missing one plan is recoverable;
// a plan that can't be started is not.
//
// The shapes below are form-ready — numbers as strings, time as HH:MM — because
// the consumer is a set of `defaultValue`s in an uncontrolled form, and every
// conversion that doesn't happen at the boundary happens in JSX instead.

import 'server-only'
import { z } from 'zod'
import { DAY_TOKENS, type WhenChoice } from '@/lib/goals/schedule-input'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type GoalKind = 'reduce' | 'adherence' | 'program' | 'metric' | 'custom'

export type GoalTemplate = {
  slug: string
  label: string
  blurb: string
  /** Pre-written, present tense. Prefilled into the form — never a blank box. */
  identityStatement: string
  /** The same identity in <=24 chars, for list rows. */
  identityShort: string
  /** Edge OFF: cessation, medication, anything where a slip is a hard day. */
  isSensitive: boolean
  /** Published guide behind this plan, if there is one. */
  guideSlug: string | null
  isKindDefault: boolean

  // ── the form payload ──────────────────────────────────────────────────────
  kind: GoalKind
  title: string
  metricKey: string
  metricUnit: string
  direction: 'down' | 'up' | 'hold' | null
  curve: 'none' | 'linear' | 'step'
  /** Empty string means "ask him" — see the endpoint note in migration 136. */
  baseline: string
  target: string
  weeks: string
  stepDays: string
  when: WhenChoice
  days: string[]
  /** HH:MM. Postgres hands back HH:MM:SS, which a time input won't accept. */
  time: string
}

export const TEMPLATE_SELECT =
  'slug, label, blurb, identity_suggestion, identity_short_suggestion, is_sensitive, ' +
  'guide_slug, kind, title_suggestion, metric_key, metric_unit, direction, curve, ' +
  'baseline_value, target_value, weeks, step_every_days, recur_when, recur_days, ' +
  'local_time, is_kind_default, sort_order'

const KINDS = ['reduce', 'adherence', 'program', 'metric', 'custom'] as const

// Mirrors the table's CHECKs. Where they disagree, this wins on screen and the
// table wins on write — which is the right way round: the DB is the last line.
const RowSchema = z.object({
  slug: z.string().min(1),
  label: z.string().trim().min(1),
  blurb: z.string().trim().min(1),
  identity_suggestion: z.string().trim().max(160).nullish(),
  identity_short_suggestion: z.string().trim().max(24).nullish(),
  is_sensitive: z.boolean().nullish(),
  guide_slug: z.string().trim().min(1).nullish(),
  kind: z.enum(KINDS),
  title_suggestion: z.string().nullish(),
  metric_key: z.string().nullish(),
  metric_unit: z.string().nullish(),
  direction: z.enum(['down', 'up', 'hold']).nullish(),
  curve: z.enum(['none', 'linear', 'step']),
  baseline_value: z.number().nullish(),
  target_value: z.number().nullish(),
  weeks: z.number().int().positive().nullish(),
  step_every_days: z.number().int().positive().nullish(),
  recur_when: z.enum(['daily', 'weekdays', 'days', 'monthly']),
  recur_days: z.array(z.string()).nullish(),
  local_time: z.string().min(4),
  is_kind_default: z.boolean().nullish(),
})
  // The three invariants the create route enforces. A row that fails any of them
  // produces a form that cannot be submitted successfully, which is worse than a
  // shelf with one fewer plan on it.
  .refine((r) => r.curve !== 'step' || r.step_every_days != null, {
    message: 'a stepped curve needs step_every_days',
  })
  .refine((r) => r.curve === 'none' || r.weeks != null, {
    message: 'a curved template needs weeks',
  })
  .refine(
    (r) => r.recur_when !== 'days' || (r.recur_days ?? []).some((d) => DAY_TOKENS.includes(d as never)),
    { message: 'recur_when=days needs at least one real day token' },
  )

function toTemplate(row: z.infer<typeof RowSchema>): GoalTemplate {
  return {
    slug: row.slug,
    label: row.label.trim(),
    blurb: row.blurb.trim(),
    identityStatement: row.identity_suggestion?.trim() ?? '',
    identityShort: row.identity_short_suggestion?.trim() ?? '',
    isSensitive: row.is_sensitive === true,
    guideSlug: row.guide_slug?.trim() || null,
    isKindDefault: row.is_kind_default === true,

    kind: row.kind,
    title: row.title_suggestion ?? '',
    metricKey: row.metric_key ?? '',
    metricUnit: row.metric_unit ?? '',
    direction: row.direction ?? null,
    curve: row.curve,
    baseline: numToField(row.baseline_value),
    target: numToField(row.target_value),
    weeks: numToField(row.weeks),
    stepDays: numToField(row.step_every_days),
    when: row.recur_when,
    // Filtered through the canonical token list so a stray value can't reach a
    // checkbox — normalizeDays() would drop it later anyway, but then the form
    // and the RRULE would have disagreed in between.
    days: DAY_TOKENS.filter((token) => (row.recur_days ?? []).includes(token)),
    time: row.local_time.slice(0, 5),
  }
}

/** '' rather than '0' for absent: an empty input reads as "not set", 0 doesn't. */
function numToField(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

function parseRows(rows: unknown[]): GoalTemplate[] {
  const out: GoalTemplate[] = []
  for (const row of rows) {
    const parsed = RowSchema.safeParse(row)
    if (!parsed.success) {
      const slug = (row as { slug?: string } | null)?.slug ?? '(unknown)'
      console.error(
        `goal_templates: dropping unusable row "${slug}" — ${parsed.error.issues[0]?.message}`,
      )
      continue
    }
    out.push(toTemplate(parsed.data))
  }
  return out
}

/**
 * The picker's shelf: concrete plans first, then the five generic kind shapes
 * that sit behind "Something else →".
 *
 * One query, one round trip. RLS keeps `status='hidden'` rows out for everyone
 * but an admin, so retiring a plan is an UPDATE and not a deploy.
 */
export async function loadTemplateShelf(
  client: Queryable,
): Promise<{ plans: GoalTemplate[]; kindDefaults: GoalTemplate[] }> {
  const { data, error } = await client
    .from('goal_templates')
    .select(TEMPLATE_SELECT)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('goal_templates: shelf read failed —', error.message)
    return { plans: [], kindDefaults: [] }
  }

  const all = parseRows(data ?? [])
  return {
    plans: all.filter((t) => !t.isKindDefault),
    kindDefaults: all.filter((t) => t.isKindDefault),
  }
}

/** One template by slug, or null if it's gone, hidden, or unusable. */
export async function loadTemplate(
  client: Queryable,
  slug: string,
): Promise<GoalTemplate | null> {
  if (!slug) return null
  const { data, error } = await client
    .from('goal_templates')
    .select(TEMPLATE_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('goal_templates: read failed —', error.message)
    return null
  }
  if (!data) return null
  return parseRows([data])[0] ?? null
}

/**
 * The kind default for a `kind`, for old `/goals/new?kind=reduce` links.
 *
 * The unique partial index on (kind) where is_kind_default guarantees there's at
 * most one, so this can't quietly pick between two rows.
 */
export async function loadTemplateForKind(
  client: Queryable,
  kind: string,
): Promise<GoalTemplate | null> {
  if (!KINDS.includes(kind as GoalKind)) return null
  const { data, error } = await client
    .from('goal_templates')
    .select(TEMPLATE_SELECT)
    .eq('kind', kind)
    .eq('is_kind_default', true)
    .maybeSingle()

  if (error) {
    console.error('goal_templates: kind-default read failed —', error.message)
    return null
  }
  if (!data) return null
  return parseRows([data])[0] ?? null
}

// Exported for the unit test, which asserts the parser rejects exactly the rows
// the table's CHECKs would have rejected.
export const __testing = { RowSchema, toTemplate, parseRows }
