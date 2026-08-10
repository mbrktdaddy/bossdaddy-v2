import type { BossTool } from '../types'
import { localDateInZone } from '@/lib/goals/recurrence'
import { loadPickableGoals, pickGoalByHint, type PickableGoal } from '@/lib/goals/pick'
import { logOccurrenceEntry, logOffDayEntry, GoalLogError } from '@/lib/goals/log'
import { loadGoalFacts, targetVerdict } from '@/lib/goals/facts'
import { VOTE_KINDS } from '@/lib/goals/progress'

// ─────────────────────────────────────────────────────────────────────────────
// THE FIRST WRITE TOOL. Everything before this one only read.
//
// It COMMITS IN-TURN rather than asking first, which is a deliberate exception to
// the concierge's confirm-before-commit rule, granted on three conditions that all
// hold here and would not hold for creating a goal:
//
//   1. The write is small, owner-scoped, and REVERSIBLE — undo_goal_entry exists
//      precisely so this exception is safe, and it's why the entry id comes back
//      in the result.
//   2. It is the PRIMARY logging path. "Want me to log that? [Yes]" puts a round
//      trip in front of the one action the whole product needs to stay frictionless.
//   3. It cannot be double-counted: the shared core keys a prompted log on the
//      occurrence id, so logging the same day from here and from a reminder email
//      is refused by Postgres rather than counted twice.
//
// Creating goals or schedules keeps the confirm gate. A recurring commitment with
// notifications attached is not in the same risk class as one day's entry.
//
// THE MODEL DOES NO ARITHMETIC. It passes a phrase and a number; everything the
// reply needs — the vote count, which day of the plan this is, whether the number
// beat the target, whether the goal is a sensitive one — is computed here and
// returned as facts. See lib/goals/facts.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const logGoalEntry: BossTool = {
  minTier: 'free',
  definition: {
    name: 'log_goal_entry',
    description:
      "Log a day on one of this dad's goals — he took his meds, hit the gym, or smoked 4 today. Writes it immediately; no confirmation step, because logging has to be frictionless. Pass `goal` as whatever he called it ('smoking', 'meds', 'the taper') and this resolves it; if it's ambiguous you'll get the candidates back and should ask him which, in one short line. Pass `value` for anything he counted. Returns the real numbers for your reply — votes, day of plan, whether it beat today's target — plus an entry_id you can hand to undo_goal_entry if he says scratch that. Use the numbers exactly as returned and never work them out yourself.",
    input_schema: {
      type: 'object',
      properties: {
        goal: {
          type: 'string',
          description:
            "Which goal, in his words ('smoking', 'meds', 'lifting'), or a goal_id from list_goals.",
        },
        value: {
          type: 'number',
          description:
            'The number he actually did, for goals that count something (4 cigarettes, 182 lb). Omit for did-it-or-didn\'t goals.',
        },
        action: {
          type: 'string',
          enum: ['done', 'skipped'],
          description:
            "'done' (default) when he did it — INCLUDING an honest over-target number, which still counts. 'skipped' ONLY when he says he's deliberately not doing it today.",
        },
        when: {
          type: 'string',
          description:
            "'today' (default), 'yesterday', or a YYYY-MM-DD date. Never a future date.",
        },
        note: {
          type: 'string',
          description: 'A short note in his own words, if he gave one worth keeping.',
        },
      },
      required: ['goal'],
    },
  },

  async handler(input, ctx) {
    if (!ctx.userId) {
      return { content: JSON.stringify({ ok: false, error: 'not_signed_in' }) }
    }

    const action = input.action === 'skipped' ? 'skipped' : 'completed'
    const rawValue = input.value == null ? null : Number(input.value)
    const value = rawValue != null && Number.isFinite(rawValue) ? rawValue : null
    const note = typeof input.note === 'string' ? input.note.slice(0, 280) : null

    // ── which goal ──────────────────────────────────────────────────────────
    const goals = await loadPickableGoals(ctx.supabase, ctx.userId)
    if (!goals.length) {
      return {
        content: JSON.stringify({
          ok: false,
          error: 'no_goals',
          note: 'Nothing on the board to log against. He can set one up at /goals.',
        }),
      }
    }

    const picked = pickGoalByHint(goals, String(input.goal ?? ''))
    if (picked.kind !== 'match') {
      // Ambiguity is returned, never resolved by preference. Logging into the
      // wrong goal is the one failure this tool must not produce.
      return {
        content: JSON.stringify({
          ok: false,
          error: picked.kind === 'ambiguous' ? 'ambiguous_goal' : 'no_matching_goal',
          candidates: (picked.kind === 'ambiguous' ? picked.candidates : goals).map(brief),
          note: 'Ask him which one, in one short line. Do not pick for him.',
        }),
      }
    }
    const goal = picked.goal

    // ── which day ───────────────────────────────────────────────────────────
    // Resolved in the GOAL's zone. The server's "today" is not his, and a log at
    // 11:40pm belongs to the day he means.
    const zone = await zoneFor(ctx.supabase, goal.id)
    const today = safeLocalDate(zone)
    const localDate = resolveWhen(String(input.when ?? 'today'), today)
    if (!localDate) {
      return { content: JSON.stringify({ ok: false, error: 'bad_date' }) }
    }
    if (localDate > today) {
      return {
        content: JSON.stringify({
          ok: false,
          error: 'future_date',
          note: "Can't log a day that hasn't happened yet.",
        }),
      }
    }

    // ── prompted or off-day ─────────────────────────────────────────────────
    // If a scheduled day is sitting open, this log resolves THAT — which is what
    // clears the "Due" badge and stops the reminder chasing him. Only when nothing
    // is open does it become a free-standing entry.
    const occurrenceId = await openOccurrenceOn(ctx.supabase, goal.id, localDate)

    try {
      const result = occurrenceId
        ? await logOccurrenceEntry(ctx.supabase, {
            occurrenceId,
            userId: ctx.userId,
            action,
            value,
            source: 'boss',
          })
        : await logOffDayEntry(ctx.supabase, {
            goalId: goal.id,
            userId: ctx.userId,
            localDate,
            value,
            note,
            // An off-day 'skipped' is a real statement ("not today"); everything
            // else falls through to the goal's own default (a measurement for
            // goals that count something, a plain completion otherwise).
            kind: action === 'skipped' ? 'skipped' : undefined,
            source: 'boss',
          })

      if (result.outcome === 'not_found') {
        return { content: JSON.stringify({ ok: false, error: 'goal_vanished' }) }
      }
      if (result.outcome === 'needs_value') {
        return {
          content: JSON.stringify({
            ok: false,
            error: 'needs_value',
            tracks: goal.metric_key,
            unit: goal.metric_unit,
            note: `Ask him for the number — this one tracks ${goal.metric_key}.`,
          }),
        }
      }

      // ── the facts for the reply ──────────────────────────────────────────
      const facts = await loadGoalFacts(ctx.supabase, goal.id)
      const verdict = targetVerdict(result.value, facts?.todayTarget ?? null, goal.direction)

      return {
        content: JSON.stringify({
          ok: true,
          already_logged: result.outcome === 'already_resolved',
          entry_id: result.entryId,
          goal_id: goal.id,
          title: goal.title,
          local_date: result.localDate,
          logged_value: result.value,
          unit: goal.metric_unit,
          entry_kind: result.kind,

          // Did this entry count as showing up? A skip and a bare measurement
          // don't. Say nothing about votes when this is false — never announce
          // the absence of one.
          was_a_vote: result.kind != null && (VOTE_KINDS as readonly string[]).includes(result.kind),

          identity: facts?.identityStatement ?? null,
          identity_short: facts?.identityShort ?? null,
          sensitive: facts?.sensitive ?? false,

          votes: facts?.votes ?? null,
          day_in_plan: facts?.dayInPlan ?? null,
          plan_days: facts?.planDays ?? null,
          days_running: facts?.streak ?? null,
          today_target: facts?.todayTarget ?? null,
          // 'better' | 'met' | 'over' | null. 'over' is INFORMATION, not a verdict
          // on the man, and it does not cost a vote.
          vs_target: verdict,
        }),
      }
    } catch (err) {
      const message = err instanceof GoalLogError ? err.message : 'Could not save that.'
      console.error('log_goal_entry failed', message)
      return { content: JSON.stringify({ ok: false, error: 'write_failed', note: message }) }
    }
  },
}

function brief(goal: PickableGoal) {
  return { goal_id: goal.id, title: goal.title, tracks: goal.metric_key }
}

/** 'today' | 'yesterday' | YYYY-MM-DD → a calendar date, or null if unparseable. */
function resolveWhen(when: string, today: string): string | null {
  const key = when.trim().toLowerCase()
  if (!key || key === 'today') return today
  if (key === 'yesterday') return shiftDays(today, -1)
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null
}

/** Calendar arithmetic at UTC midnight, so a DST change can't move the date. */
function shiftDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const out = new Date(Date.UTC(y!, m! - 1, d!) + days * 86_400_000)
  return `${out.getUTCFullYear()}-${pad(out.getUTCMonth() + 1)}-${pad(out.getUTCDate())}`
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

async function zoneFor(
  client: { from: (t: string) => any },   // eslint-disable-line @typescript-eslint/no-explicit-any
  goalId: string,
): Promise<string> {
  const { data } = await client
    .from('goal_schedules')
    .select('timezone')
    .eq('goal_id', goalId)
    .limit(1)
    .maybeSingle()
  return (data as { timezone: string } | null)?.timezone ?? 'UTC'
}

/**
 * An unresolved scheduled day on that date, if there is one. `missed` counts —
 * catch-up is always available, and logging one is how a missed day becomes a
 * `catchup` entry rather than a second, free-standing row.
 */
async function openOccurrenceOn(
  client: { from: (t: string) => any },   // eslint-disable-line @typescript-eslint/no-explicit-any
  goalId: string,
  localDate: string,
): Promise<string | null> {
  const { data } = await client
    .from('goal_occurrences')
    .select('id, due_at')
    .eq('goal_id', goalId)
    .eq('local_date', localDate)
    .in('status', ['pending', 'notified', 'snoozed', 'missed'])
    .order('due_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

function safeLocalDate(zone: string): string {
  try {
    return localDateInZone(new Date(), zone)
  } catch {
    return localDateInZone(new Date(), 'UTC')
  }
}
