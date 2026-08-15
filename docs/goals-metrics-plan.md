# Goals — the metrics layer

**Status:** planned, no code. Written 2026-08-15 from a full read of the spine
(migrations 134–139/145, `lib/goals/*`, the sweep, and the three surfaces).

**What this is.** The goals spine's *plumbing* is ahead of the commercial field:
local wall clock + IANA zone per schedule, three idempotency keys, an outbox with
a claim/settle split, derived numbers that are never authoritative, private-by-
default RLS, plus four things nothing mainstream has (identity/votes, stamped
taper curves, accountability partners, an `.ics` feed). The **measurement layer**
is where it sits behind — and two of the gaps are defects, not missing features.

This plan fixes the defects first, then closes the gaps the field considers table
stakes. Phases are independently shippable and deliberately ordered so the
cheapest correctness win lands before any new surface area.

> **Source of truth reminders.** Display strings → `lib/labels.ts`. Internal
> names never change (Naming Doctrine). Migrations start from
> `supabase/migrations/_TEMPLATE.sql`, are applied **manually by the operator**,
> and are followed by `npm run db:types`. Next free number is **146**.

---

## The findings, in one place

| # | Finding | Evidence |
|---|---|---|
| D1 | **The streak is calendar-day based, so it's wrong for every non-daily goal.** `computeStreak` walks back one calendar date at a time and breaks on the first date with no entry. A MO/WE/FR program can therefore never read above 1, and a Sunday weigh-in never above 1. | `lib/goals/progress.ts:60-85`; affects the seeded `lift-three-times` and `weigh-in-sundays` plans plus the `program` and `metric` kind defaults — 4 of 12 rows in mig 136's seed |
| D2 | **A goal can never finish.** `goals.status = 'completed'` and `completed_at` exist and are unreachable; `buildRrule` emits no `UNTIL`/`COUNT`; `materialize()` has no target-date bound. A finished 8-week taper keeps materializing days and sending "Today's number: 0" forever, `planWindow` clamps to "Day 56 of 56" permanently, and the vote count freezes at the target date while the man keeps logging. | `134_goals_spine.sql:100-102`, `schedule-input.ts:152-167`, `actions.ts:147`, `sweep.ts:139-174`. **Proof it's a defect and not a decision: the `.ics` feed already bounds the same rule at `target_date`** (`recurrence.ts:191-194` → `calendar/[token]/route.ts:109`), so a subscriber's calendar ends the plan while push and email don't |
| G1 | No flexible frequency ("3× a week, any days"). RRULE only expresses fixed weekdays. Present in Streaks, Habitify, Loop, Done, Atoms. | `schedule-input.ts:152` |
| G2 | No longest streak, no rolling completion rate, no all-time total. Adherence is lifetime-only — the one metric that by construction can't recover from a bad month. | `stats.ts:80`, `progress.ts:92` |
| G3 | No history visualization: a 14-row text list, and a weight goal ships with a progress bar and no graph. | `goals/[id]/page.tsx:458-472` |
| G4 | Skip breaks the streak; Streaks/Habitify treat a skip as a neutral rest day. | `progress.ts:81` |
| G5 | Smaller: snooze exists only on the emailed one-tap link, not in `/today`; one nudge per occurrence, no follow-up; only the *latest* open occurrence is actionable, so three missed days can't all be caught up; `deleteGoalEntry` has no UI affordance (only the Boss can undo); the `'relapse'` entry kind has no writer anywhere; timezone is captured once at create and never revisited. | `tap/route.ts:22`, `sweep.ts:336`, `goals/[id]/page.tsx:137`, `log.ts:262` |

Out of scope for this plan, named so the omissions read as decisions: gamification
(points/levels — against the brand), CSV export, weekly digest email, widgets.

---

## Phase 1 — make the numbers true

**Fixes D1 + G2. One migration, one pure module, two readers. Ship this alone.**

The streak is already on screen and already wrong; everything else in this plan is
additive. This phase also establishes the seam (metrics fold over *scheduled
occurrences*, not over calendar dates) that Phase 4 needs.

### The rule

A streak is **consecutive scheduled dates that were kept**, walking back from the
most recent resolved date. Per-date classification, derived from the occurrences
on that date plus the entries on that date:

| Class | Condition | Effect on the walk |
|---|---|---|
| **kept** | a `VOTE_KINDS` entry (`completed`/`catchup`) exists with that `local_date` | `streak++`, continue |
| **open** | no vote entry, and some occurrence on the date is still `pending`/`notified`/`snoozed` | **skip** — neither extends nor breaks, continue |
| **broken** | no vote entry, and every occurrence on the date is resolved (`missed`/`skipped`) | stop |

Three things this gets right that the current fold doesn't:

- **Grace comes from the status, not from the date.** Age-out marks `missed`
  exactly when `due_at + grace_minutes` lapses (`sweep.ts:657-661`), so "is today
  still in play?" is a question the sweep has already answered. Reading status
  instead of special-casing `todayLocal` also means an 11 pm occurrence with a
  4-hour grace behaves correctly across midnight, and a tick that didn't run
  doesn't zero anybody's streak.
- **Off-day entries neither extend nor break it.** An unprompted workout on a
  Tuesday is a vote (it already is) and stays out of the MO/WE/FR chain. This is
  the field convention and it keeps two questions separate, the same way
  `VOTE_KINDS` keeps "did he show up" apart from "did he beat the number".
- **Kept keys on the entry, not the occurrence.** `logOccurrenceEntry` always
  writes an entry stamped with the occurrence's own `local_date` (`log.ts:123`),
  so the two are equivalent — and keying on entries keeps `VOTE_KINDS` the single
  definition of showing up.

**Partial days count as kept.** A two-dose day with one dose logged is `kept` for
the streak and 50% for adherence. Adherence is per-occurrence and already carries
that information; making the streak carry it too would be one number answering two
questions.

`computeStreak` stays exported as the **no-schedule fallback** (a goal whose
schedules were all deleted has no scheduled dates to walk) and keeps its tests.

### New metrics

- `longest_streak` — the max run over the same walk, ascending. **Invariant: this
  column may only be raised.** The recompute currently reads a goal's full
  occurrence + entry history with no row cap (`stats.ts:43-48`); if a window is
  ever introduced there, an unguarded recompute would silently shrink a man's best
  run. Write it as `max(existing, computed)`.
- `rate_30d_done` / `rate_30d_total` — `adherenceRate` over occurrences whose
  `local_date` falls in the last 30 days. Stored as a pair, not a percentage, so
  the reader can render "18 of 21" and so an empty window reads "no data" instead
  of 0% (same reason `logged_total` exists).
- `kept_total` — all-time vote entries. The number that only goes up, for a habit
  running longer than any one plan window.

### Work

| File | Change |
|---|---|
| `supabase/migrations/146_goal_stats_streak_metrics.sql` | four columns on `goal_stats`, all `not null default 0`; column comments incl. the may-only-be-raised invariant. **No RLS changes** — the existing owner-read/owner-write policies cover new columns. **No backfill** — `refreshStaleStats` (`sweep.ts:697`) rewrites every goal within 90 minutes, which is exactly the cold start it was written for |
| `lib/goals/progress.ts` | add `computeScheduledStreak(occurrences, entries, opts)`, `longestScheduledStreak(...)`, `windowedAdherence(occurrences, fromYmd, toYmd)`; re-document `computeStreak` as the no-schedule fallback |
| `lib/goals/stats.ts` | pass occurrences into the streak call; write the four new columns; `max()` guard on longest |
| `app/(tools)/goals/[id]/page.tsx` | stat grid → **Days running** (schedule-aware, folded from the occurrences already fetched), **Best run** (read from `goal_stats`, *not* folded — the page's entry fetch is capped at 400 rows), **Logged** = 30-day with lifetime as the hint |
| `app/(tools)/goals/page.tsx` | index card line reads the new columns (it already reads `goal_stats`) |
| `lib/goals/facts.ts` | expose `longestStreak` + the 30-day pair so the Boss stops describing a wrong streak |
| `tests/unit/goals-progress.test.ts` | MO/WE/FR streak across three weeks; Sunday-only streak across four weeks; off-day entry doesn't extend or break; yesterday still `pending` is grace, not a break; `missed` breaks; longest survives a break in the middle; 30-day window boundary is inclusive at both ends |

### Verification

`npm run check` · `npm test` · `npm run prebuild`. Then a manual pass, on the
phone (mobile is source of truth):

1. Create a `lift-three-times` goal (MO/WE/FR). Log the last two scheduled days
   via `/today`. **Expect "2 days running"** — today it reads 1 or `—`.
2. On an off day, open the goal → "Log something else" → log it. **Expect the
   streak unchanged and the vote count +1.**
3. Create a daily goal, log 3 days, deliberately miss one, log 2 more. **Expect
   Days running 2, Best run 3.**
4. Check the same two goals' cards on `/goals` and ask the Boss "how's my lifting
   going" — all three surfaces must agree.

---

## Phase 2 — let a plan finish

**Fixes D2. No migration — `status`/`completed_at` already exist.**

### The rule

A goal completes when **its target date has passed in its own zone and nothing is
left unresolved.** Derived, not a button: nobody should have to tell the app that
eight weeks is over.

1. **Bound materialization.** In `materializeOne`, drop expanded occurrences whose
   `localDate > goal.target_date` before the upsert. Filtering on the *local date*
   rather than converting the target date to a UTC instant keeps this exact with no
   zone arithmetic — the expansion already carries each occurrence's own local
   date. Open-ended goals (no `target_date`) are unaffected and still recur
   forever, which is correct.
2. **New sweep phase, `completePlans()`,** after age-out and before the stats
   recompute: for active goals with a `target_date` earlier than today-in-zone and
   no occurrence in `pending`/`notified`/`snoozed`, set `status = 'completed'`,
   `completed_at = now()`. Guarded on `.eq('status', 'active')`, so it's idempotent
   under retry, overlap, or a redeploy mid-run — the same discipline as the outbox.
   Paused and archived goals are left alone: a parked plan is not a finished one.
3. **A finished state on the detail page.** Final tally (votes, best run, adherence),
   the identity line kept, no log form when nothing is open, and **Restore**
   (`completed → active`) plus **Start it again** (a fresh goal prefilled from
   `template_slug`) as the two ways forward. `setGoalStatus` gains `completed` as a
   *source* state it can leave, never as one a form can set.
4. **The completion moment is in-app only.** A `notifications` row (mig 082) and
   the page itself. **No email, no push** — the copy for a finished cessation plan
   is exactly where identity language wants to leak into the inbox, and
   `check:goals-identity` (prebuild) will fail the build if it does. That guard is
   the reason this stays a decision and not a temptation.

### Why this also un-freezes votes

`planWindow`'s `end` is the target date, so today's behaviour is a vote count that
stops moving while logging continues (`progress.ts:192-215`, `facts.ts:102`). Once
the goal actually completes, that same frozen number is the *final tally* of a
finished plan — correct rather than quietly stale. **Do not "fix" it by extending
the window past `target_date`;** the fix is the terminal state.

### Work

`lib/goals/sweep.ts` (bound + new phase + `SweepReport.completed`) ·
`app/(tools)/goals/[id]/page.tsx` (finished state) · `app/(tools)/goals/actions.ts`
(restore) · `app/(tools)/goals/page.tsx` (a completed goal leaves the active list
without being archived) · `lib/labels.ts` (finished-state copy) ·
`lib/goals/facts.ts` (the Boss must know a plan is finished before it congratulates
someone on day 81 of 56) · tests: post-target occurrences are dropped; completion
is idempotent; an open-ended goal never completes; a paused goal past its target
doesn't complete; an unresolved catch-up from last week blocks completion.

**Explicitly out of scope, named:** "extend this plan by N weeks". It's the obvious
next ask, and it interacts with the curve (`planDays` is a duration and the step
count depends on the exact span — `progress.ts:171-179`). It gets its own change.

### Manual pass

Create a goal with `target_date` = yesterday and a daily schedule, resolve every
open day, let one sweep tick run (`*/15`). Expect: status `completed`, a
notification, a finished detail page, **no further reminders**, and — the point of
this phase — the `.ics` feed and the nudges now telling the same story.

---

## Phase 3 — show the history

**Closes G3. No migration. Pure-function core, zero client JS.**

1. `lib/goals/history.ts` — `buildHistoryGrid(occurrences, entries, fromYmd, toYmd)`
   returning one cell per date: `kept` / `missed` / `skipped` / `open` /
   `not-scheduled`. Same classification as Phase 1's walk, so the grid and the
   streak can't disagree. Unit-testable; the page only renders.
2. A 12-week grid on the detail page, server-rendered — the page has no client
   bundle today and doesn't need one for this.
3. **Sensitive goals get no red.** Mig 136 already promises "no red heatmap cells"
   for `config.sensitive`; intensity comes from neutral/accent tints, never a
   red↔green scale. Also watch the dark-canvas anti-patterns (no `bg-{color}-50`
   chips, no invisible shadows) — see `[[feedback_dark_canvas_anti_patterns]]`.
4. **Metric goals get a line.** Logged values against the stamped curve, inline
   SVG, no chart library. `occurrences.target_value` is the curve as it was
   actually asked for, so the plotted target line is history, not a recomputation.
   Load the `dataviz` skill before choosing colours/axes.
5. Accessibility: every cell titled with date + state, and a text summary above the
   grid — a grid alone is not a metric for a screen reader.

---

## Phase 4 — flexible frequency ("3× a week")

**Closes G1. Migration 147. Do this last: it's the only phase that forks the
metrics layer by schedule shape, and it wants Phase 1's seam in place first.**

### The model — recommendation

Keep **one materialization path** (mig 134's rule: the materializer must not fork
per goal type). A quota schedule stores `FREQ=DAILY` as its *candidate* set and
adds `goal_schedules.weekly_target`. The fork lives in notify, age-out, and
metrics, not in expansion:

- **Notify** — suppress the nudge for the rest of a week whose quota is already met.
- **Age out** — a quota schedule **never** marks a day `missed`. The unit of
  success is the week; unmet days in a met week are not misses.
- **Metrics** — streak counts **weeks** met ("3 weeks running"), adherence is
  weeks-met / weeks-resolved, and the UI reads "2 of 3 this week".
- **`.ics`** — quota schedules are **excluded from the feed** in v1. Seven chips a
  week for a 3× habit is worse than nothing, and "which three days" is unknowable
  in advance. Say so in the share UI rather than shipping a wrong calendar.

Rejected: materializing only the picked days (that's what exists), or materializing
7 days and letting age-out mark 4 misses a week — which would produce a 43%
adherence score on a perfectly kept habit.

### Migration 147

`goal_schedules.weekly_target integer check (weekly_target is null or between 1
and 7)` · `goal_templates.recur_when` gains `'times_per_week'` + its own
`weekly_target`, with a CHECK that the two are set together (mirroring the create
route's validation, which is why mig 136's CHECKs exist) · `buildRrule` returns
`FREQ=DAILY` for the new choice · `parseWhen` round-trips it · `describeRrule`
renders "3 times a week".

---

## Phase 5 — the skip ruling

**Closes G4. Small code, needs a decision.**

**Recommendation: a skip becomes neutral** — a skipped date is transparent to the
streak (neither extends nor breaks) and is excluded from the adherence denominator.

The argument isn't "the field does it" (though Streaks and Habitify both do). It's
that today, tapping **Not today** and ignoring the nudge entirely produce the
*same* outcome — both break the run — so the app currently gives a man no reason
to answer honestly. Making the honest answer strictly better than silence is the
same principle already written into `VOTE_KINDS`: honest logging must never be the
penalised behaviour. Illness, travel and a kid's ER trip are rest days, not
failures.

Guard against hollowing it out: skips are neutral, but they are **not** votes and
never count as kept. A man who skips every day has a streak of zero, not infinity.

Also in this phase: **`'relapse'` has no writer anywhere in the app.** Either give
`reduce` goals an "I slipped" affordance (the Boss's prompt already knows how to
respond to one — `lib/boss/prompt.ts:69-71`) or document the value as reserved. An
enum member with no writer is exactly the trap the articles→guides rename left
behind twice.

---

## Invariants no phase may break

1. **Identity language never enters push or email.** Enforced by
   `check:goals-identity` in prebuild. Phase 2's completion moment is in-app only
   for this reason.
2. **A vote count never goes down**, and nothing is ever an anti-vote.
3. **Derived numbers are never authoritative.** `goal_stats` must stay droppable
   and rebuildable; nothing may become the only copy of a fact.
4. **No `is_admin()` on any goals table.** These rows are medication schedules and
   cessation logs; admin is moderation-only (migs 106/107).
5. **`planDays` is a duration**, and `/api/goals/create` writes
   `target_date = started_on + weeks × 7`. The curve's step count depends on that
   exact span — do not make the ordinal arithmetic tidier.
6. **The three idempotency keys stay.** `(schedule_id, due_at)`,
   `(user_id, client_entry_id)`, `(occurrence_id, channel)`.
7. **An entry's `local_date` is computed at log time by the client and never
   re-derived at sync time.**
8. **Occurrences are insert-only via the service role.** A client that could
   insert its own occurrences could manufacture a streak.
9. **`goal_stats.longest_streak` may only be raised** (Phase 1).

## Sequencing

Phase 1 → 2 → 3 are independent of each other and can ship in any order; that one
is chosen because it fixes the wrongest number first and builds the seam Phase 4
needs. Phase 4 depends on Phase 1. Phase 5 is a one-file change once the ruling
lands, and if it lands *before* Phase 1 ships, fold it into Phase 1's walk rather
than editing the same function twice.
