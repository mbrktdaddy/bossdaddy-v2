import type { SupabaseClient } from '@supabase/supabase-js'

// Single source of truth for what a caller can do with The Boss. The API route
// reads its rate limits through getEntitlements(). Every member's chats are
// saved and personalized — those are not tier levers.
//
// The Boss is members-only (the API rejects logged-out callers). v1 has NO
// billing: every signed-in member gets `free`. When subscriptions ship,
// getEntitlements() resolves `plus` from an active subscription row — and
// NOTHING else in The Boss changes. That is the whole point of this seam.

export type BossTier = 'free' | 'plus'

export interface Entitlements {
  tier: BossTier
  bossRateKey: 'boss' | 'boss-plus'
  // Operator exemption: the admin (profiles.role = 'admin', set only by DB
  // trigger — never client-writable) skips the per-member rate limits.
  unlimited: boolean
}

// Every tier runs the same model (the concierge bucket, lib/flags.ts) — an
// invisible model tier is a weak differentiator. When `plus` ships it should
// differ on things a member can actually feel (volume first).
const PRESETS: Record<BossTier, Omit<Entitlements, 'unlimited'>> = {
  free: { tier: 'free', bossRateKey: 'boss' },
  plus: { tier: 'plus', bossRateKey: 'boss-plus' },
}

export async function getEntitlements(supabase: SupabaseClient, userId: string): Promise<Entitlements> {
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single()
  // TODO(monetization): look up an active Boss+ subscription for userId and
  // use PRESETS.plus when found. Until then, every member is `free`.
  return { ...PRESETS.free, unlimited: profile?.role === 'admin' }
}
