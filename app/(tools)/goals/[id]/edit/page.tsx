// Edit a goal: its own fields, and the schedules attached to it.
//
// Two independent concerns on one screen, each its own plain form:
//   • goal fields  → /api/goals/update
//   • schedules    → /api/goals/schedule  (op = create | update | delete)
//
// Separate forms rather than one giant submit, because they have genuinely
// different consequences: retitling a goal touches nothing else, while retiming a
// schedule rebuilds its unresolved future. Bundling them would mean a typo fix
// silently re-materializing someone's calendar.
//
// Still no client JavaScript. The day checkboxes and channel checkboxes are
// always visible per form, prefilled from the stored rule via parseWhen().

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import {
  parseWhen, describeRrule, WEEKDAY_OPTIONS, COMMON_ZONES,
} from '@/lib/goals/schedule-input'

export const metadata: Metadata = {
  title: `Edit — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string; saved?: string }>
}

type GoalRow = {
  id: string; title: string; description: string | null; kind: string
  metric_key: string | null; metric_unit: string | null; direction: string | null
  baseline_value: number | null; target_value: number | null
  curve: string; step_every_days: number | null
  started_on: string; target_date: string | null
  identity_statement: string | null; identity_short: string | null
}
type ScheduleRow = {
  id: string; label: string | null; rrule: string; local_time: string
  timezone: string; channels: string[]; muted: boolean; start_date: string
}

const WHEN_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays only (Mon–Fri)' },
  { value: 'days', label: 'Only the days I pick' },
  { value: 'monthly', label: 'Once a month' },
]

const CHANNEL_OPTIONS = [
  { value: 'push', label: 'Push' },
  { value: 'email', label: 'Email' },
  { value: 'inapp', label: 'In-app only' },
]

export default async function EditGoalPage({ params, searchParams }: Props) {
  const { id } = await params
  const { msg, saved } = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to edit this goal.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  const { data: goalRow } = await supabase
    .from('goals')
    .select('id, title, description, kind, metric_key, metric_unit, direction, baseline_value, target_value, curve, step_every_days, started_on, target_date, identity_statement, identity_short')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  const goal = goalRow as unknown as GoalRow | null
  if (!goal) notFound()

  const { data: scheduleRows } = await supabase
    .from('goal_schedules')
    .select('id, label, rrule, local_time, timezone, channels, muted, start_date')
    .eq('goal_id', goal.id)
    .order('local_time', { ascending: true })
  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]

  const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''
  const wantsCurve = goal.curve !== 'none' || goal.baseline_value != null
  const weeksFromDates = goal.target_date
    ? Math.round(daysBetween(goal.started_on, goal.target_date) / 7)
    : null
  const defaultZone = schedules[0]?.timezone ?? 'America/Chicago'

  return (
    <Wrap>
      <Link
        href={`/goals/${goal.id}`}
        className="inline-flex items-center py-3 text-xs text-muted hover:text-prose"
      >
        ← {goal.title}
      </Link>

      <header className="mt-4 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          Edit this goal
        </h1>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg.slice(0, 200)}
        </p>
      ) : null}
      {saved === '1' && !msg ? (
        <p className="mt-6 rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
          Saved.
        </p>
      ) : null}

      {/* ── the goal itself ──────────────────────────────────────────────── */}
      <form action="/api/goals/update" method="post" className="mt-8 space-y-6">
        <input type="hidden" name="goalId" value={goal.id} />
        <input type="hidden" name="curve" value={goal.curve} />
        {goal.direction ? <input type="hidden" name="direction" value={goal.direction} /> : null}

        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">The goal</h2>

        <Field label="Name">
          <input
            type="text" name="title" required maxLength={120} defaultValue={goal.title}
            className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
          />
        </Field>

        <Field label="Notes (optional)">
          <textarea
            name="description" rows={3} maxLength={2000}
            defaultValue={goal.description ?? ''}
            className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
          />
        </Field>

        {/* ── identity ──────────────────────────────────────────────────────
            Always available, never required, and clearing it is a first-class
            action: empty both boxes and every surface goes back to plain process
            language. Nothing else has to be switched off. */}
        <fieldset className="space-y-3 rounded-xl border border-soft bg-surface p-5">
          <legend className="px-1 text-sm font-semibold text-prose">
            {LABELS.goals.identityLegend}
          </legend>
          <input
            type="text" name="identityStatement" maxLength={160}
            defaultValue={goal.identity_statement ?? ''}
            placeholder="I am the kind of dad who…"
            className="w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
          />
          <Field label={LABELS.goals.identityShortLabel}>
            <input
              type="text" name="identityShort" maxLength={24}
              defaultValue={goal.identity_short ?? ''}
              placeholder="Smoke-Free"
              className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
            />
          </Field>
          <p className="text-xs text-faint">{LABELS.goals.identityHint}</p>
        </fieldset>

        {goal.metric_key != null || wantsCurve ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Counting">
              <input
                type="text" name="metricKey" maxLength={40} defaultValue={goal.metric_key ?? ''}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
            <Field label="Unit">
              <input
                type="text" name="metricUnit" maxLength={20} defaultValue={goal.metric_unit ?? ''}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
          </div>
        ) : null}

        {wantsCurve ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start at">
                <input
                  type="number" name="baseline" step="any" inputMode="decimal"
                  defaultValue={goal.baseline_value ?? ''}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Target">
                <input
                  type="number" name="target" step="any" inputMode="decimal"
                  defaultValue={goal.target_value ?? ''}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Weeks">
                <input
                  type="number" name="weeks" min={1} max={520} inputMode="numeric"
                  defaultValue={weeksFromDates ?? ''}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
            </div>
            {goal.curve === 'step' ? (
              <Field label="Step down every (days)">
                <input
                  type="number" name="stepDays" min={1} max={365} inputMode="numeric"
                  defaultValue={goal.step_every_days ?? ''}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
                />
              </Field>
            ) : null}
            <p className="text-xs text-faint">
              Weeks count from {goal.started_on}, when you started — moving the
              deadline won&apos;t restart a taper you&apos;re already into. Changing any
              of these re-stamps the targets on days that haven&apos;t happened yet.
              Days you already logged stay exactly as they were.
            </p>
          </>
        ) : null}

        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Save the goal
        </button>
      </form>

      {/* ── schedules ────────────────────────────────────────────────────── */}
      <section className="mt-12 space-y-4 border-t border-soft pt-8">
        <div>
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Reminders</h2>
          <p className="mt-2 text-xs text-faint">
            A goal can have more than one. Lifting Mon/Wed/Fri plus a Sunday
            weigh-in is one goal with two reminders.
          </p>
        </div>

        {schedules.map((schedule) => {
          const { when, days } = parseWhen(schedule.rrule)
          const time = schedule.local_time.slice(0, 5)
          const zones = COMMON_ZONES.includes(schedule.timezone)
            ? COMMON_ZONES
            : [schedule.timezone, ...COMMON_ZONES]
          // Collapsed by default. Each reminder's form is a dozen controls
          // (4 radios, 7 day chips, time, zone, 3 channels), so three reminders
          // expanded made this page a wall on a phone. The summary carries the
          // whole answer in one line, and you open only the one you're changing.
          return (
            <details key={schedule.id} className="rounded-xl border border-soft bg-surface p-5">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
                <span className="text-sm font-semibold text-prose">
                  {describeRrule(schedule.rrule, schedule.local_time)}
                  {schedule.muted ? ' · muted' : ''}
                </span>
                <span className="shrink-0 text-xs text-accent-text">Change</span>
              </summary>

              <form action="/api/goals/schedule" method="post" className="mt-4 space-y-4">
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="op" value="update" />
                <input type="hidden" name="scheduleId" value={schedule.id} />

                <Field label="Label (optional)">
                  <input
                    type="text" name="label" maxLength={60} defaultValue={schedule.label ?? ''}
                    placeholder="Morning dose"
                    className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
                  />
                </Field>

                <WhenFields
                  idPrefix={schedule.id}
                  when={when}
                  days={days}
                  time={time}
                  zone={schedule.timezone}
                  zones={zones}
                  channels={schedule.channels}
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="min-h-11 rounded-lg bg-accent px-5 py-3 text-xs font-bold text-white hover:bg-accent-hover transition-colors"
                  >
                    Save this reminder
                  </button>
                </div>
              </form>

              {schedules.length > 1 ? (
                <form action="/api/goals/schedule" method="post" className="mt-3">
                  <input type="hidden" name="goalId" value={goal.id} />
                  <input type="hidden" name="op" value="delete" />
                  <input type="hidden" name="scheduleId" value={schedule.id} />
                  <button
                    type="submit"
                    className="min-h-11 inline-flex items-center text-xs text-faint hover:text-muted underline"
                  >
                    Remove this reminder
                  </button>
                </form>
              ) : null}
            </details>
          )
        })}

        {/* ── add another ────────────────────────────────────────────────── */}
        <details className="rounded-xl border border-soft bg-surface p-5">
          <summary className="min-h-11 flex cursor-pointer items-center text-sm font-semibold text-prose">
            Add another reminder
          </summary>
          <form action="/api/goals/schedule" method="post" className="mt-4 space-y-4">
            <input type="hidden" name="goalId" value={goal.id} />
            <input type="hidden" name="op" value="create" />

            <Field label="Label (optional)">
              <input
                type="text" name="label" maxLength={60} placeholder="Sunday weigh-in"
                className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
              />
            </Field>

            <WhenFields
              idPrefix="new"
              when="days"
              days={['SU']}
              time="07:00"
              zone={defaultZone}
              zones={COMMON_ZONES.includes(defaultZone) ? COMMON_ZONES : [defaultZone, ...COMMON_ZONES]}
              channels={['push', 'email']}
            />

            <button
              type="submit"
              className="min-h-11 w-full rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              Add it
            </button>
          </form>
        </details>

        <p className="text-xs text-faint">
          Changing a time or the days rebuilds the days ahead. Anything you already
          logged, skipped, or missed is history and stays put. Removing a reminder
          keeps your log{unit ? '' : ''} — it just stops the nudges from that one.
        </p>
      </section>
    </Wrap>
  )
}

/** The when/time/zone/channel block, shared by every schedule form on the page. */
function WhenFields({
  idPrefix, when, days, time, zone, zones, channels,
}: {
  idPrefix: string
  when: string
  days: string[]
  time: string
  zone: string
  zones: readonly string[]
  channels: string[]
}) {
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-xs text-muted">When</legend>
        {WHEN_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-3 rounded-lg border border-soft bg-surface-raised px-4 py-3"
          >
            <input
              type="radio" name="when" value={option.value}
              defaultChecked={when === option.value}
              className="accent-accent"
            />
            <span className="text-sm text-prose">{option.label}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend className="text-xs text-muted">Which days (for &ldquo;only the days I pick&rdquo;)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAY_OPTIONS.map((day) => (
            <label
              key={`${idPrefix}-${day.value}`}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-soft bg-surface-raised px-3 py-3 sm:flex-none"
            >
              <input
                type="checkbox" name="days" value={day.value}
                defaultChecked={days.includes(day.value)}
                className="accent-accent"
              />
              <span className="text-sm text-prose">{day.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Time">
          <input
            type="time" name="localTime" required defaultValue={time}
            className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
          />
        </Field>
        <Field label="Timezone">
          <select
            name="timezone" defaultValue={zone}
            className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
          >
            {zones.map((z) => (
              <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </Field>
      </div>

      <fieldset>
        <legend className="text-xs text-muted">How to reach you</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHANNEL_OPTIONS.map((channel) => (
            <label
              key={`${idPrefix}-${channel.value}`}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-soft bg-surface-raised px-3 py-3 sm:flex-none"
            >
              <input
                type="checkbox" name="channels" value={channel.value}
                defaultChecked={channels.includes(channel.value)}
                className="accent-accent"
              />
              <span className="text-sm text-prose">{channel.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  )
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const [ay, am, ad] = fromYmd.split('-').map(Number)
  const [by, bm, bd] = toYmd.split('-').map(Number)
  return Math.round(
    (Date.UTC(by!, bm! - 1, bd!) - Date.UTC(ay!, am! - 1, ad!)) / 86_400_000,
  )
}
