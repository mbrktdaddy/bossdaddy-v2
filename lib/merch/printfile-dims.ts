import { getPrintfileInfo } from '@/lib/printful'
import { MERCH_CATALOG, type MerchBlank } from './printful-catalog'

// Resolves the REAL print-area dimensions for a blank's placement from Printful's
// printfile API, so the print file we render and the mockup position always match
// what Printful expects — for any product, not just the ones we hardcoded.
//
// Cached per (product, placement) for the process lifetime (printfiles rarely
// change). Falls back to the pinned MERCH_CATALOG dimensions on any failure, so
// a Printful hiccup or missing scope never breaks rendering.

export interface PrintDims { width: number; height: number }

const cache = new Map<string, PrintDims>()

export async function resolvePrintfileDims(blank: MerchBlank): Promise<PrintDims> {
  const spec = MERCH_CATALOG[blank]
  const fallback: PrintDims = { width: spec.printWidthPx, height: spec.printHeightPx }
  if (!spec.catalogProductId) return fallback

  const key = `${spec.catalogProductId}:${spec.placement}`
  const cached = cache.get(key)
  if (cached) return cached

  try {
    const info = await getPrintfileInfo(spec.catalogProductId)

    // Find the printfile id mapped to this placement (from the first variant that
    // declares it) → look up its dimensions.
    let printfileId: number | undefined
    for (const vp of info.variant_printfiles ?? []) {
      const id = vp.placements?.[spec.placement]
      if (id != null) { printfileId = id; break }
    }
    const pf =
      (info.printfiles ?? []).find((p) => p.printfile_id === printfileId) ??
      (info.printfiles ?? [])[0]

    const dims: PrintDims =
      pf?.width && pf?.height ? { width: pf.width, height: pf.height } : fallback
    cache.set(key, dims)
    return dims
  } catch {
    return fallback
  }
}
