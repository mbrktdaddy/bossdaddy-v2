// Pure checks that stand between a draft and the public page. The workspace
// checklist shows "No placeholders" as advice; these are the server-side gate
// (submit + approve) and the render-time safety net, so an empty image slot
// can never ship as a dashed "Image slot" box on a published piece.

import { EMPTY_ELEMENTS_MESSAGE, UNFILLED_VIDEO_MESSAGE, hasEmptyElements, hasUnfilledVideoSlots } from './elements'

const PLACEHOLDER_FIGURE_RE = /<figure\b[^>]*\bclass="[^"]*\bbd-image-placeholder\b[^"]*"[^>]*>[\s\S]*?<\/figure>/gi

/** True when the body still carries an unfilled inline-image slot. */
export function hasUnfilledImageSlots(html: string | null | undefined): boolean {
  if (!html) return false
  return new RegExp(PLACEHOLDER_FIGURE_RE.source, 'i').test(html)
}

export const UNFILLED_SLOTS_MESSAGE =
  'This piece still has empty image slots. Fill them from the Inline images panel or remove them before it can go live.'

/** Render-time safety net: drop any placeholder figure that slipped through. */
export function stripPlaceholderFigures(html: string): string {
  return html.replace(new RegExp(PLACEHOLDER_FIGURE_RE.source, 'gi'), '')
}

/**
 * THE publish gate (submit + approve, both content types): the first reason the
 * body may not go public, or null. One function so a new unfinished-thing check
 * lands in all four routes at once.
 */
export function publishBlocker(html: string | null | undefined): string | null {
  if (hasUnfilledImageSlots(html)) return UNFILLED_SLOTS_MESSAGE
  if (hasUnfilledVideoSlots(html)) return UNFILLED_VIDEO_MESSAGE
  if (hasEmptyElements(html)) return EMPTY_ELEMENTS_MESSAGE
  return null
}
