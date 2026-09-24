/**
 * ArticleSurface — single source of truth for the long-form reading surface
 * (dark-first makeover, docs/archive/dark-makeover-rollout-plan.md).
 *
 * Policy (reversed 2026-09-23): bare CANVAS at every breakpoint, matching
 * what `lg+` already did. The prior policy boxed the whole mobile/tablet
 * column in a `bg-surface` panel — which put nested `bg-surface` elements
 * (disclosure notice, category chip, related cards, FAQ items) inside a
 * same-color panel, washing them out. Removing the panel fixes that for
 * free instead of requiring per-element contrast tweaks.
 *
 * Applied to the article's main content column.
 */
export const ARTICLE_SURFACE_CLASS = ''
