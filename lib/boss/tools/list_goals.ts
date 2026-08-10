import type { BossTool } from '../types'
import { loadPickableGoals, loadStatsFor, summarizeGoalForModel } from '@/lib/goals/pick'

// C — Keep going. What this dad is actually working on: tapers, medication,
// programs, anything with a schedule behind it.
//
// Read-only and member-only. A logged-out visitor has no goals and RLS would
// return an empty list anyway — the tier gate just makes the answer honest ("sign
// in and the Boss can hold this for you") instead of "you have no goals".
//
// The Boss calls this to ANSWER ("what am I tracking?", "how's the taper going?")
// and to disambiguate before logging. It is NOT a prerequisite for logging:
// log_goal_entry resolves a name itself, so the common one-shot — "smoked 4 today"
// — doesn't cost an extra round trip.
//
// Numbers come from `goal_stats`, one batched read for every goal rather than a
// per-goal fetch. Votes are deliberately absent here: they're a per-plan number
// that means something on ONE goal's page, and computing them across a list would
// be a count query per row for a line nobody asked for.
export const listGoals: BossTool = {
  minTier: 'free',
  definition: {
    name: 'list_goals',
    description:
      "List the goals this dad is tracking on Boss Daddy — cutting something back, a daily habit like medication or vitamins, a workout program, or something he measures. Use it when he asks what he's working on or how something's going, and when you need to know which goal he means before logging. Returns each goal's real numbers: today's target, days running, what's open. Report those as given — never estimate or recalculate them.",
    input_schema: {
      type: 'object',
      properties: {
        include_paused: {
          type: 'boolean',
          description: 'Include paused goals too. Default true; pass false for active only.',
        },
      },
    },
  },
  async handler(input, ctx) {
    if (!ctx.userId) {
      return { content: JSON.stringify({ goals: [], note: 'Not signed in.' }) }
    }

    const goals = await loadPickableGoals(ctx.supabase, ctx.userId, {
      includePaused: input.include_paused !== false,
    })

    if (!goals.length) {
      return {
        content: JSON.stringify({
          goals: [],
          note: 'Nothing on the board yet. He can set one up at /goals — a target plus a schedule.',
        }),
      }
    }

    const stats = await loadStatsFor(ctx.supabase, goals.map((g) => g.id))

    return {
      content: JSON.stringify({
        goals: goals.map((goal) => summarizeGoalForModel(goal, stats.get(goal.id))),
      }),
    }
  },
}
