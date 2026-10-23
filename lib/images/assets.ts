import { createAdminClient } from '@/lib/supabase/admin'

// Server-only: resolve stored image URLs → the media_assets facts a public
// page needs to render them well (intrinsic size for next/image, origin for the
// credit line). One query per page for every figure + the hero, so figures
// written before mig 166 (no width/height on the <img>, no data-origin on the
// <figure>) still get dimensions and disclosure without a content rewrite.
// media_assets is author/admin-read under RLS, hence the admin client — a
// read-only lookup keyed by URLs the page already renders.

export interface ImageAssetFacts {
  width: number | null
  height: number | null
  origin: string | null
}

export type ImageAssetMap = Map<string, ImageAssetFacts>

export async function lookupImageAssets(urls: Iterable<string>): Promise<ImageAssetMap> {
  const out: ImageAssetMap = new Map()
  const wanted = Array.from(new Set(Array.from(urls).filter(Boolean)))
  if (wanted.length === 0) return out
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('media_assets')
      .select('url, width, height, origin')
      .in('url', wanted)
    if (error || !data) return out
    for (const row of data as { url: string; width: number | null; height: number | null; origin: string | null }[]) {
      out.set(row.url, { width: row.width, height: row.height, origin: row.origin })
    }
  } catch (err) {
    console.error('lookupImageAssets failed:', err)
  }
  return out
}
