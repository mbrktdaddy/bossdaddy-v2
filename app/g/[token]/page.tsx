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
      <p className="mt-3 text-sm text-prose-muted">
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
            <span className="text-sm text-prose-muted">
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
            className="flex-1 rounded-lg border border-soft bg-surface px-4 py-3 text-sm font-semibold text-prose-muted hover:bg-surface-hover"
          >
            Not today
          </button>
        </div>
      </form>

      <div className="mt-8 space-y-3">
        <p className="text-xs text-prose-faint">
          &ldquo;Not today&rdquo; costs you nothing. Showing up tomorrow is the whole game.
        </p>
        {/* THE DO-NOTHING EXIT, and it earns its place as much as the buttons do.
            EVERY other way off this screen writes something — "Did it", "Not today"
            and snooze all resolve the occurrence — so a man who opened the reminder by
            accident, or who means to deal with it after work, had one unlabelled logo
            and a guess. It says what leaving costs, because "does closing this count as
            a skip?" is exactly the doubt that makes someone tap a button he didn't
            mean.

            Points at /goals, not /goals/<id>: this link exists for a device that may
            have no session, where the list degrades into the explainer plus a sign-in
            and the goal itself would be an auth wall. */}
        <p className="text-xs text-prose-faint">
          Leaving logs nothing — this one stays open, and you can still log it later,
          even days later.{' '}
          <Link href="/goals" className="font-semibold text-accent-text hover:text-accent">
            Leave it for now →
          </Link>
        </p>
      </div>
    </Shell>
  )
}

function isResolved(status: string): boolean {
  return status === 'completed' || status === 'skipped'
}

// THE ONLY CHROME THIS PAGE GETS, and it has two jobs beyond decoration.
//
// 1. SAY WHERE YOU ARE. This was a bare 36px logo with no text. A dad arriving from
//    an email — possibly having never seen the site on this device — got an
//    unlabelled badge that happened to be a link home. The wordmark is the same
//    lockup as the tools chrome, so "this is Boss Daddy, and that goes home" needs
//    no guessing.
// 2. GIVE HIM A WAY OUT. Every state now ends with a neutral exit. There is no
//    history to go "back" to worth trusting — a push tap or a mail-client handoff
//    arrives with no referrer, so a Back affordance would be a guess dressed up as a
//    control, and honest links beat a fake one. It also can't be a JS
//    `history.back()`: this page is deliberately script-free so it works in a locked
//    down webview (see the rules at the top of the file).
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
      <Link href="/" aria-label="Boss Daddy — home" className="mb-10 inline-flex items-center gap-2.5">
        <Image
          src="/images/bd-logo-icon.png"
          alt=""
          width={36}
          height={36}
          className="h-8 w-8 shrink-0 object-contain"
        />
        <span className="shrink-0 text-lg font-black tracking-tight">
          <span className="text-accent">BOSS</span>
          <span className="text-prose"> DADDY</span>
        </span>
      </Link>
      {children}
      <div className="mt-10 border-t border-soft pt-5">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-xs font-semibold text-prose-muted hover:text-prose"
        >
          ← Home
        </Link>
      </div>
    </main>
  )
}

// The button has always gone to the goal itself when we know which one it is; the
// label said "Open your goals", which reads like the list and made the right
// destination look like a wrong one. Say what it does — and when the goal is
// unknown (bad token, deleted occurrence), the list genuinely is the destination.
function Message({ heading, body, goalId }: { heading: string; body: string; goalId?: string }) {
  return (
    <>
      <h1 className="text-2xl font-black text-prose">{heading}</h1>
      <p className="mt-3 text-sm text-prose-muted">{body}</p>
      <Link
        href={goalId ? `/goals/${goalId}` : '/goals'}
        className="mt-8 inline-block rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover"
      >
        {goalId ? 'Open this goal →' : 'Open your goals →'}
      </Link>
    </>
  )
}
