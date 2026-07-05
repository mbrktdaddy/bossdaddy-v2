// ─────────────────────────────────────────────────────────────────────────────
// Merch Studio — Printful catalog & print-spec reference
//
// VERIFIED against the live Printful catalog on 2026-07-05 (via
// `npm run merch:discover`). Print files are transparent PNGs sized to the
// placement's printfile dimensions below.
//
// Variant IDs are NOT hardcoded (the tee alone has 590). Instead we pin the
// catalog product id + which garment colors map to each colorway + the size run,
// and the publish flow resolves the concrete variant_ids dynamically via
// getCatalogProduct(). This keeps the file small and survives catalog churn.
// ─────────────────────────────────────────────────────────────────────────────

import type { MerchColorway } from './templates'

export type MerchBlank = 'tee' | 'hat' | 'mug'

export interface BlankConfig {
  blank: MerchBlank
  label: string
  /** Printful catalog product id (verified). Null = not wired for publish yet. */
  catalogProductId: number | null
  /** Placement key used as the sync-variant file `type`. */
  placement: string
  /** Print-file pixel dimensions (transparent PNG) for this placement. */
  printWidthPx: number
  printHeightPx: number
  dpi: number
  /** False = design/preview only, no publish yet (e.g. hat = embroidery). */
  publishable: boolean
  /** Catalog garment color name(s) to publish per design colorway. */
  garmentColors: Record<MerchColorway, string[]>
  /** Catalog "size" values to publish (for mugs this is the oz option). */
  sizes: string[]
  notes?: string
}

export const MERCH_CATALOG: Record<MerchBlank, BlankConfig> = {
  tee: {
    blank: 'tee',
    label: 'T-Shirt',
    catalogProductId: 71, // Bella + Canvas 3001 "Unisex Staple T-Shirt"
    placement: 'front',
    printWidthPx: 1800,
    printHeightPx: 2400,
    dpi: 150,
    publishable: true,
    // on-dark art → dark garment; on-light art → white garment.
    garmentColors: { dark: ['Black'], light: ['White'] },
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    notes: 'DTG. front_large placement (2250×2700) available if we want a bigger print.',
  },
  mug: {
    blank: 'mug',
    label: 'Mug',
    catalogProductId: 19, // White Glossy Mug
    placement: 'default',
    printWidthPx: 2700,
    printHeightPx: 1050,
    dpi: 300,
    publishable: true,
    // Mug is white regardless — always use the light colorway art for contrast.
    garmentColors: { dark: ['White'], light: ['White'] },
    sizes: ['11 oz'], // also available: '15 oz', '20 oz'
    notes: 'Wraparound sublimation. Keep critical content centered. Use light colorway.',
  },
  hat: {
    blank: 'hat',
    label: 'Hat',
    catalogProductId: null, // deferred — hats are EMBROIDERY (different file pipeline)
    placement: 'embroidery_front',
    printWidthPx: 1200,
    printHeightPx: 800,
    dpi: 150,
    publishable: false,
    garmentColors: { dark: [], light: [] },
    sizes: [],
    notes: 'Embroidery: needs digitized file + thread colors, not a flat PNG. Not wired for publish in v1.',
  },
}

export function getBlankSpec(blank: MerchBlank): BlankConfig {
  return MERCH_CATALOG[blank]
}
