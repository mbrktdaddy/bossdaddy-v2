// Create a goal. Two states, no client JavaScript:
//
//   /goals/new            → pick the shape (five kinds, plain links)
//   /goals/new?kind=…     → the form for that kind, prefilled with sane defaults
//
// The two-step split is what lets the form be tailored per kind without
// JavaScript to show and hide fields — and it reads better than one long form
// with half its inputs irrelevant.
//
// NOBODY AUTHORS AN RRULE. The user picks "every day" or "Mon/Wed/Fri" and the
// route handler assembles the RFC 5545 string. That asymmetry is the whole point
// of storing a real RRULE underneath: full expressive power in the schema,
// four radio buttons on the screen.

import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { isValidTimeZone, localDateInZone } from '@/lib/goals/recurrence'
// Shared with the edit form so the two pickers can't drift apart.
import { WEEKDAY_OPTIONS, COMMON_ZONES } from '@/lib/goals/schedule-input'

export const metadata: Metadata = {
  title: `${LABELS.goals.newCta} — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ kind?: string; msg?: string }> }

// Defaults per kind. These ARE the template layer in its simplest form: a dad
// picking "cutting back" gets a 20 → 0 over eight weeks taper already filled in,
// which is the difference between a tool you configure and a tool you use.
const KINDS = {
  reduce: {
    label: 'Cutting back',
    blurb: 'Smoking, drinking, screen time — a number that comes down on a schedule.',
    title: 'Cut back',
    metricKey: 'cigarettes',
    metricUnit: 'per day',
    direction: 'down',
    baseline: '20',
    target: '0',
    curve: 'step',
    stepDays: '7',
    weeks: '8',
    when: 'daily',
    days: [],
    time: '20:00',
  },
  adherence: {
    label: 'Daily habit',
    blurb: 'Vitamins, medication, stretching. Did it or didn\'t.',
    title: 'Take my vitamins',
    metricKey: '',
    metricUnit: '',
    direction: null,
    baseline: '',
    target: '',
    curve: 'none',
    stepDays: '',
    weeks: '',
    when: 'daily',
    days: [],
    time: '08:00',
  },
  program: {
    label: 'Program',
    blurb: 'Workouts on set days. Couch-to-5K, lifting three times a week.',
    title: 'Lift three times a week',
    metricKey: '',
    metricUnit: '',
    direction: null,
    baseline: '',
    target: '',
    curve: 'none',
    stepDays: '',
    weeks: '12',
    when: 'days',
    days: ['MO', 'WE', 'FR'],
    time: '06:30',
  },
  metric: {
    label: 'Tracking',
    blurb: 'Weight, resting heart rate, anything you weigh or measure.',
    title: 'Get to my weight',
    metricKey: 'weight',
    metricUnit: 'lb',
    direction: 'down',
    baseline: '',
    target: '',
    curve: 'linear',
    stepDays: '',
    weeks: '16',
    when: 'days',
    days: ['SU'],
    time: '07:00',
  },
  custom: {
    label: 'Reminder',
    blurb: 'Anything else you want a nudge about.',
    title: '',
    metricKey: '',
    metricUnit: '',
    direction: null,
    baseline: '',
    target: '',
    curve: 'none',
    stepDays: '',
    weeks: '',
    when: 'daily',
    days: [],
    time: '18:00',
  },
} as const

type KindKey = keyof typeof KINDS

export default async function NewGoalPage({ searchParams }: Props) {
  const { kind: kindParam, msg } = await searchParams
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to set up a goal.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  const kind = (kindParam && kindParam in KINDS ? kindParam : null) as KindKey | null

  // ── step 1: pick the shape ────────────────────────────────────────────────
  if (!kind) {
    return (
      <Wrap>
        <Back />
        <header className="space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.goals.newCta}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
            {LABELS.goals.newHeading}
          </h1>
          <p className="text-base text-prose-muted leading-snug">{LABELS.goals.newBody}</p>
        </header>

        <ul className="mt-8 space-y-3">
          {(Object.keys(KINDS) as KindKey[]).map((key) => (
            <li key={key}>
              <Link
                href={`/goals/new?kind=${key}`}
                className="block bg-surface border border-soft hover:border-strong rounded-xl p-5 transition-colors"
              >
                <p className="text-base font-bold text-prose">{KINDS[key].label}</p>
                <p className="mt-1 text-sm text-muted">{KINDS[key].blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Wrap>
    )
  }

  // ── step 2: the form ──────────────────────────────────────────────────────
  const preset = KINDS[kind]

  // Vercel hands us the visitor's zone from the edge, so the select lands on the
  // right answer without JavaScript and without asking. Absent locally.
  const headerZone = (await headers()).get('x-vercel-ip-timezone')
  const detected = headerZone && isValidTimeZone(headerZone) ? headerZone : 'America/Chicago'
  const zones = COMMON_ZONES.includes(detected) ? COMMON_ZONES : [detected, ...COMMON_ZONES]
  const todayLocal = localDateInZone(new Date(), detected)

  const wantsMetric = kind === 'reduce' || kind === 'metric'
  const wantsCurve = kind === 'reduce' || kind === 'metric'

  return (
    <Wrap>
      <Link href="/goals/new" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
        ← Pick a different kind
      </Link>

      <header className="mt-6 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {preset.label}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {preset.blurb}
        </h1>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg}
        </p>
      ) : null}

      <form action="/api/goals/create" method="post" className="mt-8 space-y-7">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="curve" value={preset.curve} />
        {preset.direction ? <input type="hidden" name="direction" value={preset.direction} /> : null}

        <Field label="What do you want to call it?">
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            defaultValue={preset.title}
            placeholder="Say it how you'd say it out loud"
            className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
          />
        </Field>

        {wantsMetric ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="What are you counting?">
              <input
                type="text"
                name="metricKey"
                maxLength={40}
                defaultValue={preset.metricKey}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                name="metricUnit"
                maxLength={20}
                defaultValue={preset.metricUnit}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
          </div>
        ) : null}

        {wantsCurve ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-prose">The numbers</legend>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start at">
                <input
                  type="number" name="baseline" step="any" inputMode="decimal"
                  defaultValue={preset.baseline}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Target">
                <input
                  type="number" name="target" step="any" inputMode="decimal"
                  defaultValue={preset.target}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Weeks">
                <input
                  type="number" name="weeks" min={1} max={520} inputMode="numeric"
                  defaultValue={preset.weeks}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
            </div>
            {preset.curve === 'step' ? (
              <Field label="Step down every (days)">
                <input
                  type="number" name="stepDays" min={1} max={365} inputMode="numeric"
                  defaultValue={preset.stepDays}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
                />
                <span className="mt-2 block text-xs text-faint">
                  Holds steady between steps, so each level gets a fair run.
                </span>
              </Field>
            ) : null}
          </fieldset>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-prose">When should I nudge you?</legend>
          <div className="space-y-2">
            {[
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Weekdays only (Mon–Fri)' },
              { value: 'days', label: 'Only the days I pick' },
              { value: 'monthly', label: 'Once a month, on today\'s date' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-lg border border-soft bg-surface px-4 py-3">
                <input
                  type="radio" name="when" value={option.value}
                  defaultChecked={preset.when === option.value}
                  className="accent-accent"
                />
                <span className="text-sm text-prose">{option.label}</span>
              </label>
            ))}
          </div>

          {/* Always rendered rather than revealed on selection — with no client
              JavaScript there's nothing to toggle it, and a day picker that only
              appears after a round trip is worse than one that's simply ignored
              unless "the days I pick" is selected. */}
          <fieldset className="rounded-lg border border-soft bg-surface p-4">
            <legend className="px-1 text-xs text-muted">
              Which days? (used when you pick &ldquo;only the days I pick&rdquo;)
            </legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAY_OPTIONS.map((day) => (
                <label
                  key={day.value}
                  className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-soft bg-surface-raised px-3 py-3 sm:flex-none"
                >
                  <input
                    type="checkbox" name="days" value={day.value}
                    defaultChecked={(preset.days as readonly string[]).includes(day.value)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-prose">{day.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-faint">
              One day is a weekly reminder. Check all seven and it&apos;s the same
              as every day.
            </p>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Time">
              <input
                type="time" name="localTime" required defaultValue={preset.time}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
            <Field label="Your timezone">
              <select
                name="timezone"
                defaultValue={detected}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              >
                {zones.map((zone) => (
                  <option key={zone} value={zone}>{zone.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </Field>
          </div>
          <p className="text-xs text-faint">
            Your clock, not the server&apos;s. 8:30 means 8:30 all year — daylight
            saving doesn&apos;t move it.
          </p>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-prose">How should I reach you?</legend>
          {[
            { value: 'push', label: 'Push notification' },
            { value: 'email', label: 'Email' },
          ].map((channel) => (
            <label key={channel.value} className="flex items-center gap-3 rounded-lg border border-soft bg-surface px-4 py-3">
              <input
                type="checkbox" name="channels" value={channel.value}
                defaultChecked
                className="accent-accent"
              />
              <span className="text-sm text-prose">{channel.label}</span>
            </label>
          ))}
          <p className="text-xs text-faint">
            If push is dead on your device, email covers you anyway. You can mute
            any of it later.
          </p>
        </fieldset>

        <input type="hidden" name="startDate" value={todayLocal} />

        <button
          type="submit"
          className="w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
        >
          Start it
        </button>
      </form>
    </Wrap>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}

function Back() {
  return (
    <Link href="/goals" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
      ← {LABELS.goals.short}
    </Link>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      {children}
    </label>
  )
}
