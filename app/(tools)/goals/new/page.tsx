// Create a goal. Two states, no client JavaScript:
//
//   /goals/new            → the shelf: concrete plans, with the five generic
//                           shapes behind "Something else"
//   /goals/new?t=<slug>   → the form for that template, prefilled
//
// The two-step split is what lets the form be tailored per plan without
// JavaScript to show and hide fields — and it reads better than one long form
// with half its inputs irrelevant.
//
// EVERY PREFILL COMES FROM `goal_templates` (migration 136). This page used to
// carry a KINDS const whose own comment called it "the template layer in its
// simplest form"; keeping it alongside the table would have meant a taper's
// defaults living in two places, so the five kinds are rows now and the const is
// gone. lib/goals/templates.ts re-validates every row and drops what it can't
// use, so a bad seed costs one card on the shelf rather than a form that bounces.
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
import {
  loadTemplateShelf, loadTemplate, loadTemplateForKind,
} from '@/lib/goals/templates'

export const metadata: Metadata = {
  title: `${LABELS.goals.newCta} — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ t?: string; kind?: string; msg?: string }> }

export default async function NewGoalPage({ searchParams }: Props) {
  const { t: templateParam, kind: kindParam, msg } = await searchParams
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

  // `?kind=` is the old shape of this URL, kept working for bookmarks and for
  // anything that linked here before templates existed: it resolves to that
  // kind's default template rather than 404ing or dumping someone on the shelf
  // with no explanation.
  const template = templateParam
    ? await loadTemplate(supabase, templateParam)
    : kindParam
      ? await loadTemplateForKind(supabase, kindParam)
      : null

  // ── step 1: the shelf ─────────────────────────────────────────────────────
  if (!template) {
    const { plans, kindDefaults } = await loadTemplateShelf(supabase)

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

        {/* A slug that no longer resolves lands here. Say so — silently showing
            the shelf reads like the tap didn't register. */}
        {templateParam || kindParam ? (
          <p className="mt-6 rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
            That plan isn&apos;t around any more. Here&apos;s what is.
          </p>
        ) : null}
        {msg ? (
          <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
            {msg.slice(0, 200)}
          </p>
        ) : null}

        {plans.length === 0 && kindDefaults.length === 0 ? (
          // Only reachable if the read failed or the seed never ran. Better than
          // an empty page that looks like the feature is broken with no recourse.
          <p className="mt-8 rounded-xl border border-soft bg-surface p-5 text-sm text-muted">
            Can&apos;t load the plans right now. Give it a minute and try again.
          </p>
        ) : null}

        <ul className="mt-8 space-y-3">
          {plans.map((plan) => (
            <li key={plan.slug}>
              <Link
                href={`/goals/new?t=${plan.slug}`}
                className="block bg-surface border border-soft hover:border-strong rounded-xl p-5 transition-colors"
              >
                <p className="text-base font-bold text-prose">{plan.label}</p>
                <p className="mt-1 text-sm text-muted">{plan.blurb}</p>
                {plan.identityShort ? (
                  <p className="mt-3 text-xs text-eyebrow uppercase tracking-widest font-semibold">
                    {LABELS.goals.votingFor}: {plan.identityShort}
                  </p>
                ) : null}
              </Link>
              {/* Outside the card's <Link> — a link inside a link is invalid
                  markup and the inner one wins unpredictably. */}
              {plan.guideSlug ? (
                <Link
                  href={`/guides/${plan.guideSlug}`}
                  className="mt-1 inline-flex min-h-11 items-center px-1 text-xs font-semibold text-accent-text hover:text-prose"
                >
                  Read the plan behind it →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>

        {kindDefaults.length > 0 ? (
          <details className="mt-6 rounded-xl border border-soft bg-surface p-5">
            <summary className="min-h-11 flex cursor-pointer items-center text-sm font-semibold text-prose">
              {LABELS.goals.newOtherCta}
            </summary>
            <p className="mt-2 text-xs text-faint">{LABELS.goals.newOtherBody}</p>
            <ul className="mt-4 space-y-2">
              {kindDefaults.map((shape) => (
                <li key={shape.slug}>
                  <Link
                    href={`/goals/new?t=${shape.slug}`}
                    className="block rounded-lg border border-soft bg-surface-raised px-4 py-3 hover:bg-surface-hover transition-colors"
                  >
                    <p className="text-sm font-bold text-prose">{shape.label}</p>
                    <p className="mt-1 text-xs text-muted">{shape.blurb}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Wrap>
    )
  }

  // ── step 2: the form ──────────────────────────────────────────────────────

  // Vercel hands us the visitor's zone from the edge, so the select lands on the
  // right answer without JavaScript and without asking. Absent locally.
  const headerZone = (await headers()).get('x-vercel-ip-timezone')
  const detected = headerZone && isValidTimeZone(headerZone) ? headerZone : 'America/Chicago'
  const zones = COMMON_ZONES.includes(detected) ? COMMON_ZONES : [detected, ...COMMON_ZONES]
  const todayLocal = localDateInZone(new Date(), detected)

  const wantsMetric = template.kind === 'reduce' || template.kind === 'metric'
  const wantsCurve = template.curve !== 'none'

  return (
    <Wrap>
      <Link href="/goals/new" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
        ← Pick a different plan
      </Link>

      <header className="mt-6 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.kinds[template.kind] ?? LABELS.goals.kinds.custom}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {template.label}
        </h1>
        <p className="text-base text-prose-muted leading-snug">{template.blurb}</p>
      </header>

      {msg ? (
        <p className="mt-6 rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          {msg.slice(0, 200)}
        </p>
      ) : null}

      <form action="/api/goals/create" method="post" className="mt-8 space-y-7">
        <input type="hidden" name="templateSlug" value={template.slug} />
        <input type="hidden" name="kind" value={template.kind} />
        <input type="hidden" name="curve" value={template.curve} />
        {template.direction ? <input type="hidden" name="direction" value={template.direction} /> : null}

        <Field label="What do you want to call it?">
          <input
            type="text"
            name="title"
            required
            maxLength={120}
            defaultValue={template.title}
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
                defaultValue={template.metricKey}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
            <Field label="Unit">
              <input
                type="text"
                name="metricUnit"
                maxLength={20}
                defaultValue={template.metricUnit}
                className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
              />
            </Field>
          </div>
        ) : null}

        {wantsCurve ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-prose">The numbers</legend>
            {/* `required` because the curve is already set: a template may ship
                without endpoints on purpose (nobody should prefill a man's
                weight), and the ask belongs on screen rather than as a bounce
                after submit. */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Start at">
                <input
                  type="number" name="baseline" step="any" inputMode="decimal" required
                  defaultValue={template.baseline}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Target">
                <input
                  type="number" name="target" step="any" inputMode="decimal" required
                  defaultValue={template.target}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
              <Field label="Weeks">
                <input
                  type="number" name="weeks" min={1} max={520} inputMode="numeric" required
                  defaultValue={template.weeks}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-3 py-3 text-prose"
                />
              </Field>
            </div>
            {template.curve === 'step' ? (
              <Field label="Step down every (days)">
                <input
                  type="number" name="stepDays" min={1} max={365} inputMode="numeric" required
                  defaultValue={template.stepDays}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
                />
                <span className="mt-2 block text-xs text-faint">
                  Holds steady between steps, so each level gets a fair run.
                </span>
              </Field>
            ) : null}
          </fieldset>
        ) : null}

        {/* ── identity ──────────────────────────────────────────────────────
            Prefilled from the template and accepted with one tap, because
            onboarding is the lowest-motivation moment there is and a blank "who
            are you becoming?" box at that moment is how the field goes unused
            forever. Skippable: clear it and nothing downstream mentions it. */}
        <fieldset className="space-y-3 rounded-xl border border-soft bg-surface p-5">
          <legend className="px-1 text-sm font-semibold text-prose">
            {LABELS.goals.identityLegend}
          </legend>
          <input
            type="text"
            name="identityStatement"
            maxLength={160}
            defaultValue={template.identityStatement}
            placeholder="I am the kind of dad who…"
            className="w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
          />
          <Field label={LABELS.goals.identityShortLabel}>
            <input
              type="text"
              name="identityShort"
              maxLength={24}
              defaultValue={template.identityShort}
              placeholder="Smoke-Free"
              className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
            />
            <span className="mt-2 block text-xs text-faint">
              {LABELS.goals.identityShortHint}
            </span>
          </Field>
          <p className="text-xs text-faint">{LABELS.goals.identityHint}</p>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-prose">When should I nudge you?</legend>
          <div className="space-y-2">
            {[
              { value: 'daily', label: 'Every day' },
              { value: 'weekdays', label: 'Weekdays only (Mon–Fri)' },
              { value: 'days', label: 'Only the days I pick' },
              { value: 'monthly', label: 'Once a month, on the start date' },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-3 rounded-lg border border-soft bg-surface px-4 py-3">
                <input
                  type="radio" name="when" value={option.value}
                  defaultChecked={template.when === option.value}
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
                    defaultChecked={template.days.includes(day.value)}
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
                type="time" name="localTime" required defaultValue={template.time}
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

        {/* ── start date ────────────────────────────────────────────────────
            A quit date is usually "Monday", not "right now". Future is free;
            BACKDATING IS NOT OFFERED and the route rejects it — the materializer
            would expand every day since, and the sweep would age them all out to
            `missed`. That's a wall of failures on day one, which on a cessation
            goal is precisely the evidence-against-the-identity this layer exists
            to avoid. (It wouldn't send stale nudges — the sweep skips anything
            too old to be one — so the harm is entirely in what he'd see.) */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-prose">{LABELS.goals.startLegend}</legend>
          <input
            type="date"
            name="startDate"
            required
            defaultValue={todayLocal}
            min={todayLocal}
            className="w-full rounded-lg border border-soft bg-surface px-4 py-3 text-prose"
          />
          <p className="text-xs text-faint">{LABELS.goals.startHint}</p>
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

        {/* The zone the date above was picked in, so the server can tell whether
            "today" means today where he is. */}
        <input type="hidden" name="clientToday" value={todayLocal} />

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
