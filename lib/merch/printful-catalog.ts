// ─────────────────────────────────────────────────────────────────────────────
// Merch Studio — Printful catalog & print-spec reference (Phase 0 groundwork)
//
// This is the pinned target list of blank products the Studio will design for,
// plus the print-file specs each placement needs. It is consumed in Phase 3 (the
// Printful write layer: catalog lookup → file upload → create sync product) and in
// Phase 2 (the renderer, to size print files correctly).
//
// ⚠ VERIFY BEFORE PHASE 3: the catalogProductId / variant IDs and print dimensions
// below are placeholders based on common Printful blanks and MUST be confirmed
// against the live Printful catalog API (GET /products, GET /products/{id}) before
// any product is created. Printful periodically changes IDs and print areas.
//
// Print-file doctrine (Printful): supply a transparent PNG at ~150 DPI covering the
// print area. E.g. a 12"×16" front print at 150 DPI ≈ 1800×2400 px. Printful will
// reject files that are too small; larger-than-needed is fine (they downscale).
// ─────────────────────────────────────────────────────────────────────────────

export type MerchBlank = 'tee' | 'hat' | 'mug'

export interface PrintPlacement {
  /** Printful placement key, e.g. 'front', 'default', 'embroidery_front'. */
  placement: string
  /** Target print-file pixel dimensions (transparent PNG) for this placement. */
  widthPx: number
  heightPx: number
}

export interface CatalogBlank {
  blank: MerchBlank
  label: string
  /** Printful catalog product id — VERIFY against GET /products before use. */
  catalogProductId: number | null
  /** Print placements this blank supports. */
  placements: PrintPlacement[]
  /** Notes on decoration method / gotchas. */
  notes?: string
}

// NOTE: catalogProductId values are intentionally null until verified against the
// live catalog. The dimensions are safe over-estimates at ~150 DPI.
export const MERCH_CATALOG: Record<MerchBlank, CatalogBlank> = {
  tee: {
    blank: 'tee',
    label: 'T-Shirt',
    catalogProductId: null, // e.g. Bella+Canvas 3001 — VERIFY
    placements: [{ placement: 'front', widthPx: 1800, heightPx: 2400 }],
    notes: 'DTG print. Transparent PNG. Offer light + dark garment color variants.',
  },
  hat: {
    blank: 'hat',
    label: 'Hat / Cap',
    catalogProductId: null, // embroidery or patch cap — VERIFY
    placements: [{ placement: 'embroidery_front', widthPx: 1200, heightPx: 800 }],
    notes: 'Embroidery has stitch limits — simple logo/wordmark lockups only, not detailed art.',
  },
  mug: {
    blank: 'mug',
    label: 'Mug',
    catalogProductId: null, // 11oz white mug — VERIFY
    placements: [{ placement: 'default', widthPx: 2700, heightPx: 1050 }],
    notes: 'Wraparound print. Keep critical content centered; edges wrap around the handle.',
  },
}

export function getBlankSpec(blank: MerchBlank): CatalogBlank {
  return MERCH_CATALOG[blank]
}
