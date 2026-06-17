// Single source of truth for what a caller can do with The Boss. Everything —
// the API route's rate-limit key, the agent's model policy + iteration budget,
// tool access, and history persistence — reads access through getEntitlements().
//
// v1 has NO billing: logged-out visitors get `anon`, any signed-in member gets
// `free`. When subscriptions ship, getEntitlements() resolves `plus` from an
// active subscription row — and NOTHING else in The Boss changes. That is the
// whole point of this seam.

export type BossTier = 'anon' | 'free' | 'plus'

export const TIER_RANK: Record<BossTier, number> = { anon: 0, free: 1, plus: 2 }

export interface Entitlements {
  tier: BossTier
  bossRateKey: 'boss-anon' | 'boss' | 'boss-plus'
  modelPolicy: 'haiku-first' | 'sonnet-priority'
  maxIterations: number
  persistHistory: boolean
  personalize: boolean // inject the member's voice/profile context into the prompt
}

// Preset per tier. v1 'free' is intentionally generous (history + personalization
// on) since there's no paid tier to differentiate against yet — the paid levers
// (volume, Tier-3 action tools, Sonnet depth) come from `plus` once it's live.
const PRESETS: Record<BossTier, Entitlements> = {
  anon: { tier: 'anon', bossRateKey: 'boss-anon', modelPolicy: 'haiku-first',    maxIterations: 4, persistHistory: false, personalize: false },
  free: { tier: 'free', bossRateKey: 'boss',      modelPolicy: 'haiku-first',    maxIterations: 5, persistHistory: true,  personalize: true  },
  plus: { tier: 'plus', bossRateKey: 'boss-plus', modelPolicy: 'sonnet-priority', maxIterations: 8, persistHistory: true,  personalize: true  },
}

export async function getEntitlements(userId: string | null): Promise<Entitlements> {
  if (!userId) return PRESETS.anon
  // TODO(monetization): look up an active Boss+ subscription for userId and
  // return PRESETS.plus when found. Until then, every member is `free`.
  return PRESETS.free
}

export function tierAtLeast(have: BossTier, need: BossTier): boolean {
  return TIER_RANK[have] >= TIER_RANK[need]
}
