import { createAdminClient } from '@/lib/supabase/admin'
import { extractFigureSrcs } from '@/lib/inline-content'

// Server-only: resolve stored image URLs → the media_assets facts a public
// page needs to render them well (intrinsic size for next/image, origin for the
// page-level AI note). One query per page for every figure + the hero, so figures
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

/**
 * Does a public page carry any AI-generated image (hero or body)? Drives the one
 * page-level disclosure in the byline row — there are no per-image captions.
 * Fill-time `data-origin="ai"` on a figure wins without a lookup; hero + older
 * figures resolve through ONE media_assets query (`facts` is returned so the
 * caller can reuse it, e.g. for hero dimensions).
 */
export async function pageImageFacts(
  heroUrl: string | null | undefined,
  html: string,
): Promise<{ hasAiImage: boolean; facts: ImageAssetMap }> {
  const urls = [heroUrl ?? '', ...extractFigureSrcs(html)]
  const facts = await lookupImageAssets(urls)
  const hasAiImage =
    /\bdata-origin="ai"/.test(html) || Array.from(facts.values()).some((f) => f.origin === 'ai')
  return { hasAiImage, facts }
}

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
