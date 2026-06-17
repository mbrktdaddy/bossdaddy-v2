import type { BossTool } from '../types'
import { searchGear } from './search_gear'
import { searchGuides } from './search_guides'
import { researchGear } from './research_gear'

// The capability registry. A new tool = a new file here + one line in this array.
// Tier-3 action tools (create_savings_goal, read_kids, weekends, order_lookup)
// append here with `memberOnly: true` — the agent loop gates them automatically.
// research_gear is the gap fallback (member-gated, web_search) — it runs only
// when search_gear finds no tested pick.
export const BOSS_TOOLS: BossTool[] = [searchGear, searchGuides, researchGear]
