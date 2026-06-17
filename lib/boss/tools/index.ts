import type { BossTool } from '../types'
import { searchGear } from './search_gear'
import { searchGuides } from './search_guides'

// The capability registry. A new tool = a new file here + one line in this array.
// Tier-3 action tools (create_savings_goal, read_kids, weekends, order_lookup)
// append here with `memberOnly: true` — the agent loop gates them automatically.
export const BOSS_TOOLS: BossTool[] = [searchGear, searchGuides]
