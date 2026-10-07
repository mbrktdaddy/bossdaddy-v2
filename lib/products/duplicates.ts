import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import { modelKey } from '@/lib/products/identifiers'

export interface ModelDuplicate {
  id: string
  name: string
  slug: string
  brand: string | null
  model_number: string
}

/**
 * Another product with the same model number, if any (mig 159). A soft check:
 * the API returns it as a 409 the admin can override, because a kit and a
 * tool-only unit can legitimately share a model number. GTINs get the hard
 * guarantee instead (products_gtin_key).
 *
 * Model numbers compare case- and punctuation-insensitively (DCD-801B ≡
 * dcd801b). Brands must match too, unless either side has none. The catalog is
 * small, so the comparison runs here rather than in a LIKE filter.
 */
export async function findModelDuplicate(
  admin: SupabaseClient<Database>,
  input: { brand: string | null | undefined; modelNumber: string; excludeId?: string },
): Promise<ModelDuplicate | null> {
  const key = modelKey(input.modelNumber)
  if (!key) return null
  const brand = input.brand?.trim().toLowerCase() || null

  const { data, error } = await admin
    .from('products')
    .select('id, name, slug, brand, model_number')
    .not('model_number', 'is', null)
  // Fail open: the check is advisory, and a failed read shouldn't block a save.
  if (error) {
    console.error('Duplicate-model lookup failed:', error)
    return null
  }

  const hit = (data ?? []).find((p) => {
    if (p.id === input.excludeId || !p.model_number || modelKey(p.model_number) !== key) return false
    const other = p.brand?.trim().toLowerCase() || null
    return !brand || !other || brand === other
  })
  return hit ? { ...hit, model_number: hit.model_number! } : null
}

/** The 409 body the admin form turns into a "Save anyway" prompt. */
export function modelDuplicateResponse(dup: ModelDuplicate) {
  const label = dup.brand ? `${dup.brand} ${dup.model_number}` : dup.model_number
  return {
    error: `${label} is already in the catalog as "${dup.name}" (/${dup.slug}). Save anyway if this is a different version, like a kit vs. tool-only.`,
    duplicate: { id: dup.id, name: dup.name, slug: dup.slug },
  }
}
