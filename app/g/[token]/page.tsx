import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOccurrenceToken } from '@/lib/goals/links'

// One-tap logging surface. Reached from a push notification or a reminder email,
// by a dad who is probably not logged in on that device — the signed token in the
// URL is the authorization, scoped to this single occurrence.
//
// TWO RULES THIS PAGE EXISTS TO ENFORCE:
//   1. GET NEVER MUTATES. Mail clients and link scanners prefetch every URL they
//      see, so a log-on-GET link logs itself before the user opens the message.
//      This page only reads; the button POSTs to /api/goals/tap.
//   2. NO JAVASCRIPT REQUIRED. It's a plain form, so it works in an email
//      browser, a locked-down webview, or a cold PWA.

export const metadata = {
  title: 'Log it · Boss Daddy',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ state?: string }>
}

export default async function OneTapPage({ params, searchParams }: Props) {
  const { token } = await params
  const { state } = await searchParams

  const verified = verifyOccurrenceToken(token)
  if (!verified.ok) {
    return (
      <Shell>
        <Message
          heading={verified.reason === 'expired' ? 'That link has expired' : 'That link isn’t valid'}
          body={
            verified.reason === 'expired'
              ? 'Reminder links are good for two weeks. Open your goal and log it there — nothing is lost.'
              : 'It may have been cut in half by your email app. Open your goal and log it there.'
          }
        />
      </Shell>
    )
  }

  const admin = createAdminClient()
  const { data: occurrenceRow } = await admin
    .from('goal_occurrences')
    .select('id, goal_id, status, local_date, local_time, shifted, target_value')
    .eq('id', verified.payload.occurrenceId)
    .maybeSingle()

  const occurrence = occurrenceRow as unknown as {
    id: string; goal_id: string; status: string; local_date: string
    local_time: string; shifted: boolean; target_value: number | null
  } | null

  if (!occurrence) {
    return (
      <Shell>
        <Message heading="We can’t find that one" body="It may have been deleted. Open your goals to check." />
      </Shell>
    )
  }

  const { data: goalRow } = await admin
    .from('goals')
    .select('id, title, kind, metric_key, metric_unit')
    .eq('id', occurrence.goal_id)
    .maybeSingle()
  const goal = goalRow as unknown as {
    id: string; title: string; kind: string; metric_key: string | null; metric_unit: string | null
  } | null

  if (!goal) {
    return (
      <Shell>
        <Message heading="We can’t find that goal" body="It may have been deleted." />
      </Shell>
    )
  }

  // Already resolved, or just resolved by this visit. Deliberately warm and
  // final — no "you're on a 12-day streak, don't break it" pressure.
  if (state === 'logged' || state === 'skipped' || state === 'snoozed' || isResolved(occurrence.status)) {
    return (
      <Shell>
        <Message
          heading={
            state === 'snoozed' ? 'Snoozed for an hour'
              : state === 'skipped' || occurrence.status === 'skipped' ? 'Marked as skipped'
              : 'Logged. Good work.'
          }
          body={
            state === 'snoozed'
              ? 'We’ll nudge you again shortly.'
              : `${goal.title} · ${occurrence.local_date}`
          }
          goalId={goal.id}
        />
      </Shell>
    )
  }

  const wantsNumber = Boolean(goal.metric_key)
  const isCatchup = occurrence.status === 'missed'

  return (
    <Shell>
      <p className="text-xs uppercase tracking-widest text-eyebrow">
        {goal.title}
      </p>
      <h1 className="mt-2 text-2xl font-black text-prose sm:text-3xl">
        {isCatchup ? 'Logging a catch-up' : 'Log it'}
      </h1>
      <p className="mt-3 text-sm text-muted">
        {occurrence.local_date} at {occurrence.local_time.slice(0, 5)}
        {occurrence.target_value != null ? (
          <> &middot; target <span className="text-prose">{occurrence.target_value}{goal.metric_unit ? ` ${goal.metric_unit}` : ''}</span></>
        ) : null}
      </p>
      {occurrence.shifted ? (
        <p className="mt-2 text-xs text-accent-text">
          Clocks changed overnight, so this one landed at {occurrence.local_time.slice(0, 5)}.
        </p>
      ) : null}

      {/* Plain POST. No JS, no client component, nothing to hydrate. */}
      <form action="/api/goals/tap" method="post" className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />

        {wantsNumber ? (
          <label className="block">
            <span className="text-sm text-muted">
              {goal.metric_key}{goal.metric_unit ? ` (${goal.metric_unit})` : ''} — what actually happened
            </span>
            <input
              type="number"
              name="value"
              step="any"
              inputMode="decimal"
              defaultValue={occurrence.target_value ?? ''}
              className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-lg text-prose"
            />
          </label>
        ) : null}

        <button
          type="submit"
          name="action"
          value="completed"
          className="w-full rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover"
        >
          {isCatchup ? 'Log it anyway' : 'Did it'}
        </button>

        <div className="flex gap-3">
          <button
            type="submit"
            name="action"
            value="snoozed"
            className="flex-1 rounded-lg border border-soft bg-surface px-4 py-3 text-sm font-semibold text-prose hover:bg-surface-hover"
          >
            Snooze an hour
          </button>
          <button
            type="submit"
            name="action"
            value="skipped"
            className="flex-1 rounded-lg border border-soft bg-surface px-4 py-3 text-sm font-semibold text-muted hover:bg-surface-hover"
          >
            Not today
          </button>
        </div>
      </form>

      <p className="mt-8 text-xs text-faint">
        &ldquo;Not today&rdquo; costs you nothing. Showing up tomorrow is the whole game.
      </p>
    </Shell>
  )
}

function isResolved(status: string): boolean {
  return status === 'completed' || status === 'skipped'
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <Link href="/" className="mb-10 inline-flex items-center gap-2">
        <Image src="/images/bd-logo-icon.png" alt="Boss Daddy" width={36} height={36} />
      </Link>
      {children}
    </main>
  )
}

function Message({ heading, body, goalId }: { heading: string; body: string; goalId?: string }) {
  return (
    <>
      <h1 className="text-2xl font-black text-prose">{heading}</h1>
      <p className="mt-3 text-sm text-muted">{body}</p>
      <Link
        href={goalId ? `/goals/${goalId}` : '/goals'}
        className="mt-8 inline-block rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover"
      >
        Open your goals
      </Link>
    </>
  )
}
