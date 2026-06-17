import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BossTier, Entitlements } from './entitlements'

// The Boss is a tool-using agent. Each capability is a BossTool registered in
// lib/boss/tools/index.ts. v1 ships read-only retrieval tools (search_gear,
// search_guides); Tier-3 action tools (create_savings_goal, order_lookup, ...)
// drop in as new files with `memberOnly: true` — the agent loop already gates
// them. This contract is the future-proofing spine.

export interface ToolContext {
  // RLS-scoped client (anon for visitors, member otherwise). Never the admin
  // client — so any policy gap fails closed.
  supabase: SupabaseClient
  userId: string | null // null = logged-out visitor
  entitlements: Entitlements
}

export interface Citation {
  kind: 'review' | 'guide' | 'product'
  slug: string
  title: string
  url: string // /reviews/{slug} or /guides/{slug}
  // Review-only enrichment so the client can render a grounded RecommendationCard
  // without a second fetch. Buy links ONLY as /go/{slug} (tracking + affiliate tag).
  buyUrl?: string | null
  rating?: number | null
  scores?: { quality: number | null; value: number | null; ease: number | null; dailyUse: number | null } | null
  specsGrade?: number | null
  // Researched-pick enrichment (kind 'product', research_gear). These are the
  // gap-fallback shortlist: NOT field-tested, so they carry NO Boss rating/scores
  // — only what the web research surfaced. The client renders a visibly
  // second-class ResearchedCard (sources shown, no verdict, capture CTAs).
  researched?: boolean
  priceTier?: 'budget' | 'mid' | 'premium' | null
  priceText?: string | null // human price hint, e.g. "$180–220"
  fit?: string | null // one line: why it fits the stated need
  sources?: { title: string; url: string }[] | null
}

export interface BossTool {
  definition: Anthropic.Tool
  handler: (
    input: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<{ content: string; citations?: Citation[] }>
  // Minimum entitlement tier to run this tool. Default 'anon' = open to everyone
  // (incl. logged-out visitors, for the free taste). 'free' = any signed-in
  // member. 'plus' = a paid subscriber. The agent gates this against the caller's
  // entitlements and returns an upgrade/sign-in nudge instead of running it.
  minTier?: BossTier
}

// Events streamed to the client over SSE. `quota_exhausted` is emitted by the
// API route (not the agent) when a visitor runs out of free-taste turns.
export type BossStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; name: string }
  | { type: 'citations'; items: Citation[] }
  | { type: 'done'; messageId: string | null; conversationId: string | null }
  | { type: 'error'; message: string }
  | { type: 'quota_exhausted' }
