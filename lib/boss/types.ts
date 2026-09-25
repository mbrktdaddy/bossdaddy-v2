// ── Blocks: structured cards attached to a saved assistant turn ──────────────
// Today the only live producer is live search (SourceBlock). The site-content
// kinds (review / guide / product) come from the tool era — retired 2026-09-24,
// restorable from the `boss-concierge-tools-v1` git tag — and stay so members'
// saved conversations still render.
//
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

export type BlockKind = 'review' | 'guide' | 'product' | 'source'

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

// A live-search source (xAI web_search / x_search), built from the stream's
// `source` parts by toSourceBlock — never parsed from prose. `slug` is the URL.
// Third-party content: rendered as an outbound, nofollow link, never as a verdict.
export interface SourceBlock extends BlockBase {
  kind: 'source'
  origin: 'web' | 'x'
  label: string // "@handle" for an X post, the bare domain for a web page
}

// The attachment union persisted in the `citations` jsonb column. Action-tool blocks extend it later with no
// protocol change:  export type Block = ContentBlock | SourceBlock | ConfirmBlock | ResultBlock
export type Block = ContentBlock | SourceBlock

export type BossStatus = 'thinking' | 'searching-web' | 'searching-x'

// Events streamed to the client over SSE.
export type BossStreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'status'; status: BossStatus }
  | { type: 'sources'; sources: SourceBlock[] }
  | { type: 'notice'; message: string }
  | { type: 'done'; messageId: string | null; conversationId: string | null }
  | { type: 'error'; message: string }
