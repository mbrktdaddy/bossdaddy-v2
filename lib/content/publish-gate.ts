// Pure checks that stand between a draft and the public page. The workspace
// checklist shows "No placeholders" as advice; these are the server-side gate
// (submit + approve) and the render-time safety net, so an empty image slot
// can never ship as a dashed "Image slot" box on a published piece.

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
