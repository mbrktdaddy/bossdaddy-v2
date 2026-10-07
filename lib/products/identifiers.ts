// Product identifiers (mig 159): the manufacturer's model number (schema.org
// `mpn`) and the GTIN barcode number. Pure and client-safe: the admin form, the
// link import and the API all share these rules.

import type { ProductSpec } from '@/lib/products'

/** Mirrors the products_model_number_format CHECK (mig 159). */
export const MODEL_NUMBER_MAX = 60

/** Trimmed, whitespace-collapsed model number; null when empty or too long. */
export function cleanModelNumber(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim()
  return v && v.length <= MODEL_NUMBER_MAX ? v : null
}

/** Comparison key for duplicate detection: DCD-801B, dcd801b and "DCD 801B" are one model. */
export function modelKey(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** GS1 check digit: weights 3,1,3,1… from the right, excluding the check digit itself. */
function gtinCheckDigitOk(digits: string): boolean {
  let sum = 0
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(digits[i]) * w
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1])
}

/**
 * The GTIN as digits only, or null unless it's a real GTIN-8, UPC-A (12),
 * EAN-13 or GTIN-14 with a valid check digit. Spaces and hyphens are dropped
 * ("0 12345 67890 5" is a UPC as printed under the barcode).
 */
export function normalizeGtin(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/[\s-]/g, '')
  if (!/^(\d{8}|\d{12,14})$/.test(digits)) return null
  return gtinCheckDigitOk(digits) ? digits : null
}

/**
 * schema.org `sku` is the seller's stock number. On a brand's own page that's
 * usually the model number (DCD801B); on a retailer's it's their internal
 * catalog ID (Home Depot, Walmart, Best Buy, Target: all digits). So a SKU is
 * taken as the model number only when it reads like one: letters AND digits.
 * A brand with all-digit model numbers misses out; the admin types it.
 */
export function modelFromSku(sku: string | null | undefined): string | null {
  const v = cleanModelNumber(sku)
  return v && /[a-z]/i.test(v) && /\d/.test(v) ? v : null
}

const MODEL_LABEL = /^(model|model\s*(number|no\.?|#)|mpn|(manufacturer|mfr\.?)\s*part\s*(number|no\.?|#)|part\s*(number|no\.?|#))$/i
const GTIN_LABEL  = /^(gtin(\s*-?\s*(8|12|13|14))?|upc(\s*code)?|ean(\s*-?\s*13)?(\s*code)?|barcode)$/i

/** Which identifier a spec label names, if any ("Model #" → model, "UPC" → gtin). */
export function identifierKind(label: string): 'model' | 'gtin' | null {
  const l = label.trim()
  if (MODEL_LABEL.test(l)) return 'model'
  if (GTIN_LABEL.test(l)) return 'gtin'
  return null
}

/**
 * Move identifier rows out of a spec list: a "Model" / "UPC" row from an
 * import or the spec-sheet autofill belongs in its own field, not the specs.
 * The first usable value of each kind wins; a row whose value doesn't parse
 * (a malformed UPC) stays a spec, where the admin can see it.
 */
export function splitIdentifierSpecs(specs: ProductSpec[]): {
  specs: ProductSpec[]
  modelNumber: string | null
  gtin: string | null
} {
  let modelNumber: string | null = null
  let gtin: string | null = null
  const rest: ProductSpec[] = []
  for (const s of specs) {
    const kind = identifierKind(s.label ?? '')
    if (kind === 'model' && !modelNumber) {
      const v = cleanModelNumber(s.value)
      if (v) { modelNumber = v; continue }
    } else if (kind === 'gtin' && !gtin) {
      const v = normalizeGtin(s.value)
      if (v) { gtin = v; continue }
    }
    rest.push(s)
  }
  return { specs: rest, modelNumber, gtin }
}

/**
 * schema.org identifier properties for a Product in JSON-LD: spread into the
 * node. Google uses them to match the review to the exact product. Empty when
 * unknown, so pages never emit a blank identifier.
 */
export function productIdentifiersJsonLd(p: { model_number?: string | null; gtin?: string | null } | null | undefined): { mpn?: string; gtin?: string } {
  return {
    ...(p?.model_number ? { mpn: p.model_number } : {}),
    ...(p?.gtin ? { gtin: p.gtin } : {}),
  }
}

/**
 * What a product's slug is built from. Brand + model when both are known
 * (dewalt-dcd801b): short, unambiguous, and the next similar product can't
 * collide with it. Otherwise the name, as before.
 */
export function productSlugSource(p: { name: string; brand?: string | null; modelNumber?: string | null }): string {
  const brand = p.brand?.trim()
  const model = cleanModelNumber(p.modelNumber)
  return brand && model ? `${brand} ${model}` : p.name
}
