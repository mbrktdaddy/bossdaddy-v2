// What's open right now, as a card you can drop anywhere.
//
// ─────────────────────────────────────────────────────────────────────────────
// NAV IS FOR PLACES; CARDS ARE FOR STATE.
//
// "Today" was briefly a link in the tools chrome, and that was the wrong instrument:
// a nav bar answers "where can I go", and what's due is a condition, not a
// destination. Worse, it made the daily errand invisible everywhere else — the
// homepage doesn't personalize, the tools hub had no personalization at all, and Your
// Stuff listed what you're working on but never what's DUE.
//
// So this is one component with several placements (/goals, /tools, /account), each
// reading loadTodayWork() — the same function /today itself uses, so a card can never
// disagree with the page it links to. See docs/nav-ia-plan.md.
//
// NOT ON THE HOMEPAGE. Operator decision: that page stays static with no auth read
// and no added JS. It's the most LCP-sensitive surface on the site and has open bundle
// work; a card there would be the only thing forcing it dynamic.
//
// IT LINKS THROUGH, IT DOESN'T LOG. v1 deliberately: logging inline would save a
// navigation, but it would also put medication logging on a settings-adjacent page.
// Revisit as its own decision, not as a side effect of this one.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import WeekStrip from '@/components/goals/WeekStrip'
import {
  loadTodayWork, loadTodayWeek, summarizeTodayWork, todayPreviewItems,
  type TodayPreviewItem,
} from '@/lib/goals/today'

type Props = {
  /** Passed in rather than resolved here — every caller has already done the auth
   *  round trip, and doing it again per card would cost one per placement. */
  userId: string
  className?: string
  /**
   * Whether to show the start-your-first-goal prompt when there are no active goals.
   *
   * Default true: on a front door, an empty card that shows what the day WOULD look
   * like is how somebody learns the tool exists. Pass false where another component
   * on the same page already carries that invitation — `/account` sits directly above
   * WorkingOnSection, whose own empty state is the same pitch, and two stacked
   * "start a goal" cards is the redundancy this whole pass is removing.
   */
  emptyPrompt?: boolean
  /**
   * 'full' (default) lists the next few items; 'compact' shows the verdict, the week
   * and the CTA only.
   *
   * WHY A VARIANT AND NOT A SECOND COMPONENT: on /goals every goal below the card
   * already carries its own "Due" / "N open" badge and today's target, so the preview
   * rows print the same facts twice — from a DIFFERENT source (this card counts live
   * occurrences; those badges read goal_stats, which is only as fresh as the last
   * sweep tick). One number per page. The week strip stays even here, because it's
   * the one thing a list of goals cannot show.
   */
  variant?: 'full' | 'compact'
}

/** Total rows shown across both groups. Four keeps the card a card. */
const MAX_ROWS = 4

export default async function TodayCard({
  userId, className = '', emptyPrompt = true, variant = 'full',
}: Props) {
  const supabase = await createClient()
  const [work, week] = await Promise.all([
    loadTodayWork(supabase, userId),
    loadTodayWeek(supabase, userId),
  ])
  const summary = summarizeTodayWork(work)

  // No active goals. This used to render nothing on the grounds that a Today card for
  // somebody with nothing set up is an advert — but on a front door, a card that shows
  // what the day WOULD look like is how a man learns the tool is here at all. It links
  // to /goals/new rather than /today, because sending someone to an empty screen is the
  // one thing worse than not inviting them.
  if (!summary) {
    return emptyPrompt ? <EmptyToday className={className} /> : null
  }

  const due = summary.tone === 'due'

  // A COMPACT /today, not a count. The first cut was one summary line, which still made
  // the reader open the page to find out what the items WERE — the tap this card exists
  // to save. It now carries the same four things the page leads with: the verdict, the
  // week, what's open, and what's later. Same copy strings as the page (LABELS.goals),
  // so the two can't drift into describing the same day differently.
  const compact = variant === 'compact'
  const dueItems = compact ? [] : todayPreviewItems(work, MAX_ROWS)
  const laterItems = compact ? [] : todayPreviewItems(
    { ...work, dueNow: work.later },
    Math.max(0, MAX_ROWS - dueItems.length),
  )
  const shown = dueItems.length + laterItems.length
  const more = compact ? 0 : work.dueNow.length + work.later.length - shown

  return (
    <Link
      href="/today"
      className={[
        'block rounded-xl p-4 transition-colors',
        // NEVER HIDDEN WHEN CLEAR, only quieter. The old /goals panel was gated on a
        // count, which removed the only entrance to /today at exactly the moment a man
        // wants the reassurance of a clear day.
        due
          ? 'border border-strong bg-surface-raised hover:border-accent-border/60'
          : 'border border-soft bg-surface hover:border-strong',
        className,
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.goals.todayEyebrow}
          </span>
          <span className="mt-1 block text-base font-black leading-tight text-prose">
            {due ? LABELS.goals.todayHeading : LABELS.goals.todayClearHeading}
          </span>
          <span className="mt-0.5 block text-xs text-prose-muted">
            {due
              ? `${work.dueNow.length} ${work.dueNow.length === 1 ? 'thing' : 'things'} waiting on you.`
              : LABELS.goals.todayClearBody}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-text">
          {summary.cta} →
        </span>
      </div>

      {/* The week, for the glance. Same component and the same cell builder the goal
          calendar uses, so a day can't read one way here and another there. */}
      {week.cells.length === 7 ? (
        <div className="mt-3">
          <WeekStrip cells={week.cells} todayLocal={week.todayLocal} />
        </div>
      ) : null}

      {shown > 0 ? (
        <div className="mt-3 space-y-2 border-t border-soft pt-3">
          {dueItems.length > 0 ? <Rows label="Open now" items={dueItems} /> : null}
          {laterItems.length > 0 ? <Rows label="Later on" items={laterItems} /> : null}
          {more > 0 ? <p className="text-xs text-prose-faint">+{more} more</p> : null}
        </div>
      ) : null}
    </Link>
  )
}

/**
 * The first-run card: what this will look like once there's something on the board.
 *
 * ⚠️ THE EXAMPLE IS LABELLED AND DIMMED, and that is not decoration. A realistic row
 * rendered at full strength on somebody's own account page reads as *their* data — a
 * dose they don't remember scheduling. It's captioned "Example", set in faint ink, and
 * the copy is lifted verbatim from the seeded `kind-adherence` template (migration
 * 136), so it shows exactly what tapping through would actually create rather than a
 * marketing fiction.
 */
function EmptyToday({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/goals/new"
      className={[
        'block rounded-xl border border-soft bg-surface p-4 transition-colors',
        'hover:border-accent-border/60',
        className,
      ].join(' ')}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.goals.todayEyebrow}
          </span>
          <span className="mt-1 block text-base font-black leading-tight text-prose">
            {LABELS.goals.emptyHeading}
          </span>
          <span className="mt-0.5 block text-xs text-prose-muted">
            {LABELS.goals.emptyBody}
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-accent-text">
          Start one →
        </span>
      </div>

      <div className="mt-3 border-t border-soft pt-3">
        <p className="text-[10px] uppercase tracking-widest text-prose-faint">Example</p>
        <div className="mt-1 flex items-baseline justify-between gap-3 opacity-60">
          <span className="min-w-0">
            <span className="block truncate text-sm text-prose-faint">
              Take my vitamins
            </span>
            <span className="block truncate text-xs text-prose-faint">
              {LABELS.goals.votingFor}: Consistent
            </span>
          </span>
          <span className="shrink-0 tabular-nums text-xs text-prose-faint">08:00</span>
        </div>
      </div>
    </Link>
  )
}

/**
 * One group of rows. Carries `identity_short` under the title — that line is the whole
 * reason a man recognises his own goal at a glance ("Voting for: Present Dad") rather
 * than reading a title he wrote three weeks ago.
 *
 * Identity is safe HERE and not in a notification: this is a page, in a browser, with
 * context around it. See migration 136 — the prohibition is on push and email.
 */
function Rows({ label, items }: { label: string; items: TodayPreviewItem[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-prose-faint">{label}</p>
      <ul className="mt-1 space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm text-prose">{item.title}</span>
              {item.identityShort ? (
                <span className="block truncate text-xs text-prose-faint">
                  {LABELS.goals.votingFor}: {item.identityShort}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 tabular-nums text-xs text-prose-faint">
              {item.target != null
                ? `${item.target}${item.unit ? ` ${item.unit}` : ''} · ${item.time}`
                : item.time}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
