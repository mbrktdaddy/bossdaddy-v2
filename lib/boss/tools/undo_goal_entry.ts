import type { BossTool } from '../types'
import { deleteGoalEntry, GoalLogError } from '@/lib/goals/log'
import { loadGoalFacts } from '@/lib/goals/facts'

// The other half of committing without asking.
//
// log_goal_entry writes immediately because putting a confirmation step in front of
// logging would tax the one action that has to stay frictionless. That trade is
// only honest if a mistake is fixable in the same breath — so this exists, and it's
// why the log tool returns an entry_id.
//
// It also fixes something the app was quietly missing: migration 134 gave
// `goal_entries` full owner control on the grounds that "a mis-tap has to be
// fixable", and until now no surface anywhere actually let a dad remove one.
//
// Deleting an entry REOPENS its scheduled day (back to `pending`, resolved_at
// cleared) because that day genuinely is unresolved again. Today's day becomes due
// again, which is correct; an old one gets re-marked missed by the sweep, silently.
// Neither can double-nudge him — the outbox is unique per (occurrence, channel).
export const undoGoalEntry: BossTool = {
  minTier: 'free',
  definition: {
    name: 'undo_goal_entry',
    description:
      "Remove a goal entry you just logged — use it when he corrects himself ('no, that was yesterday', 'scratch that', 'wrong goal'). Pass the entry_id that log_goal_entry returned. If he's correcting the day or the number, undo the wrong entry and then log the right one in the same turn. Confirm plainly what you undid; don't make a thing of it.",
    input_schema: {
      type: 'object',
      properties: {
        entry_id: {
          type: 'string',
          description: 'The entry_id returned by log_goal_entry.',
        },
      },
      required: ['entry_id'],
    },
  },

  async handler(input, ctx) {
    if (!ctx.userId) {
      return { content: JSON.stringify({ ok: false, error: 'not_signed_in' }) }
    }

    const entryId = String(input.entry_id ?? '').trim()
    if (!entryId) {
      return { content: JSON.stringify({ ok: false, error: 'missing_entry_id' }) }
    }

    try {
      // RLS scopes the delete to his own rows, so a wrong id from anywhere is a
      // miss rather than a write — there's nothing to authorize by hand.
      const result = await deleteGoalEntry(ctx.supabase, { entryId, userId: ctx.userId })

      if (result.outcome === 'not_found') {
        return {
          content: JSON.stringify({
            ok: false,
            error: 'not_found',
            note: "That entry isn't there — it may already be undone. Say so plainly and move on.",
          }),
        }
      }

      // Re-read so the reply doesn't quote a vote count that just changed.
      const facts = result.goalId ? await loadGoalFacts(ctx.supabase, result.goalId) : null

      return {
        content: JSON.stringify({
          ok: true,
          goal_id: result.goalId,
          title: facts?.title ?? null,
          local_date: result.localDate,
          note: 'That day is open again.',
          identity: facts?.identityStatement ?? null,
          sensitive: facts?.sensitive ?? false,
          votes: facts?.votes ?? null,
          day_in_plan: facts?.dayInPlan ?? null,
          plan_days: facts?.planDays ?? null,
          days_running: facts?.streak ?? null,
        }),
      }
    } catch (err) {
      const message = err instanceof GoalLogError ? err.message : 'Could not undo that.'
      console.error('undo_goal_entry failed', message)
      return { content: JSON.stringify({ ok: false, error: 'undo_failed', note: message }) }
    }
  },
}
