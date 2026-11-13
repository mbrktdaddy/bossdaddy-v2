// The sampling knobs of every pipeline stage, in ONE place, so the routes under
// app/api/content/runs/[id]/* and the golden eval (tests/eval/content-eval.ts)
// cannot drift apart. They did: the eval judged the outline on Haiku at 2,500
// tokens / effort low for three weeks after production moved it to the content
// model at 6,000 / effort high (2026-10-30 + 2026-11-01), and ran the critic at
// 2,000 / low after production went to 5,000 / high — so its verdicts described
// a pipeline nobody shipped. The eval exists to judge THIS configuration.
//
// Why each value: docs/ai-provider-layer.md §Sampling temperature per lane. The
// caps INCLUDE reasoning tokens on the 5 generation (the 2026-11-01 note under
// that table): a successful outline measured 2,056 output tokens with 808 of
// them reasoning; the old 2,000 critic cap spent the whole budget thinking and
// returned nothing. Billing is by tokens used, so idle headroom costs nothing.
// Sections take their cap from `sectionBudget(targetWords)` in section.ts.

export type StageEffort = 'low' | 'medium' | 'high'

export const STAGE_KNOBS = {
  /** Stage 1 — the plan. Effort high: the outline is where the argument is decided (2026-10-30). */
  outline: { maxOutputTokens: 6000, effort: 'high', temperature: 0.7 },
  /** Stage 2 — one part at a time. Warmest lane: the prose. */
  section: { effort: 'high', temperature: 0.8 },
  /** Stage 3 — the structured blocks, derived from the finished prose; a review with every block plus three elements is the long case. */
  blocks:  { maxOutputTokens: 6000, effort: 'medium', temperature: 0.5 },
  /** Stage 4 — the editor. Deterministic. */
  critic:  { maxOutputTokens: 5000, effort: 'high', temperature: 0 },
} as const satisfies Record<string, { maxOutputTokens?: number; effort: StageEffort; temperature: number }>
