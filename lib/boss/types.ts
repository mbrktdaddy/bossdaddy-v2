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

// ── Blocks: structured attachments the agent streams for the client to render ──
// A Block is anything attached to a turn and rendered as a STRUCTURED CARD from
// tool DATA — never parsed from prose. That is the compliance guarantee: a buy
// link is always /go/{slug}, the FTC line always shows, even if the prose drifts.
//
// Modeled as a STRICT discriminated union on `kind`: each block carries only its
// own fields, so a guide can never accidentally hold review scores and TypeScript
// narrows cleanly at every render site. v1 ships GROUNDED-CONTENT blocks (a
// tested-review pick card, a first-class guide card, a researched-shortlist row).
// Action-tool blocks — a write-confirm preview, a "done" result card — extend the
// union LATER as new members with NO protocol change. Generalizing the old
// `citations` channel to `blocks` NOW is what "build to accept action tools"
// means at the display layer (see north star memory).
//
// Persistence: blocks are stored as-is in the boss_messages.citations jsonb
// column. Historical rows are ContentBlock[] and remain valid Block[], so the
// shared renderer reads old and new turns with no migration.

export type BlockKind = 'review' | 'guide' | 'product'

// Fields every block shares — the card's identity and where it links.
export interface BlockBase {
  slug: string
  title: string
  url: string // /reviews/{slug}, /guides/{slug}, or a /go/{slug} buy link
}

// A — Decide & Buy. A real, hands-on, approved review → the rich pick card.
export interface ReviewBlock extends BlockBase {
  kind: 'review'
  buyUrl: string | null // tracked affiliate link, /go/{slug} only
  rating: number | null
  scores: { quality: number | null; value: number | null; ease: number | null; dailyUse: number | null } | null
  specsGrade: number | null
}

// B — Fix & Build. An approved guide / how-to → the first-class content card
// (title + one-line "why this helps" + category / read-time). The enrichment
// fields are optional so search_guides can populate them incrementally.
export interface GuideBlock extends BlockBase {
  kind: 'guide'
  excerpt?: string | null // the one-line "why this helps"
  category?: string | null
  readingMinutes?: number | null
}

// A (gap fallback) — a RESEARCHED, NOT TESTED shortlist pick from research_gear.
// Carries no Boss rating/scores by design; the client renders a visibly
// second-class ResearchedList (sources shown, no verdict, capture CTAs).
export interface ProductBlock extends BlockBase {
  kind: 'product'
  researched: true
  buyUrl: string | null // tracked /go/{slug}, or null when no associate tag
  rating?: null // never tested → never rated; kept nullable so tool literals match
  priceTier: 'budget' | 'mid' | 'premium' | null
  priceText: string | null // human price hint, e.g. "$180–220"
  fit: string | null // one line: why it fits the stated need
  sources: { title: string; url: string }[] | null
}

// The grounded-content blocks shipped in v1.
export type ContentBlock = ReviewBlock | GuideBlock | ProductBlock

// The generalized attachment union streamed on the `blocks` event and persisted in
// the `citations` jsonb column. Action-tool blocks extend it later with no
// protocol change:  export type Block = ContentBlock | ConfirmBlock | ResultBlock
export type Block = ContentBlock

/**
 * @deprecated Use `Block` (or a specific member). Retained as a structural alias
 * while the agent, route and renderer migrate off the `citations` channel (PR 1
 * steps 2–6). Persisted `boss_messages.citations` rows type as this and remain
 * valid `Block[]`.
 */
export type Citation = Block

export interface BossTool {
  definition: Anthropic.Tool
  handler: (
    input: Record<string, unknown>,
    ctx: ToolContext,
  ) => Promise<{ content: string; citations?: Block[] }>
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
  // The generalized attachment channel — the agent emits structured blocks the
  // client renders as cards.
  | { type: 'blocks'; items: Block[] }
  /**
   * @deprecated Legacy event name. Emitted until the agent migrates to `blocks`
   * (PR 1 step 2); the renderer accepts both. Remove once no producer emits it.
   */
  | { type: 'citations'; items: Block[] }
  | { type: 'done'; messageId: string | null; conversationId: string | null }
  | { type: 'error'; message: string }
  | { type: 'quota_exhausted' }
