import type { BossTool } from '../types'
import { searchGear } from './search_gear'
import { searchGuides } from './search_guides'
import { researchGear } from './research_gear'
import { listGoals } from './list_goals'
import { logGoalEntry } from './log_goal_entry'
import { undoGoalEntry } from './undo_goal_entry'

// The capability registry. A new tool = a new file here + one line in this array.
// research_gear is the gap fallback (member-gated, web_search) — it runs only
// when search_gear finds no tested pick.
//
// The goals trio is the first WRITE capability the Boss has, all `minTier: 'free'`
// (member-only — a visitor has no goals) and all thin wrappers over
// lib/goals/log.ts, the same core the goals UI and the one-tap reminder link use.
// log_goal_entry commits without a confirmation step; undo_goal_entry is what makes
// that safe. Creating goals and schedules is NOT here and keeps the
// confirm-before-commit gate when it lands — a recurring commitment with
// notifications attached is a different risk class from one day's entry.
export const BOSS_TOOLS: BossTool[] = [
  searchGear,
  searchGuides,
  researchGear,
  listGoals,
  logGoalEntry,
  undoGoalEntry,
]
