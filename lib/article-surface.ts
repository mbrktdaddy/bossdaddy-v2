/**
 * ArticleSurface — single source of truth for the long-form reading surface
 * on dark (dark-first makeover, docs/archive/dark-makeover-rollout-plan.md).
 *
 * Policy: an elevated reading PANEL below `lg` (phone + tablet — no page
 * margin to frame the column, and OLED halation is worst there), and bare
 * CANVAS at `lg+` (true desktop — the wide dark margins frame the centered
 * column themselves). Reverting the policy (canvas-everywhere, panel-
 * everywhere, or a different breakpoint) is a one-line edit here that
 * cascades to every review/guide page.
 *
 * Applied to the article's main content column.
 */
export const ARTICLE_SURFACE_CLASS =
  'bg-surface border border-soft rounded-2xl p-5 sm:p-7 lg:bg-transparent lg:border-0 lg:rounded-none lg:p-0'
