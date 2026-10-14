import { unstable_cache } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAnonClient } from '@/lib/supabase/anon'
import { getSeasonalOccasions, type OccasionConfig } from '@/lib/gift-occasions'

export interface SeasonalGift {
  occ: OccasionConfig
  heroImageUrl: string | null
}

/**
 * The seasonal gift guides that are actually LIVE — visible, published, and
 * holding at least one pick. An empty collection routes to a "Coming Soon"
 * dead-end, which no shelf should link to. Ordered by seasonal relevance
 * (`getSeasonalOccasions`). Shared by the /gear hub's Shop by Occasion section
 * and the homepage's gift-season band (Phase I-6) so the two can't disagree.
 *
 * Newest published collection wins per occasion (rows arrive newest first),
 * mirroring the /gifts/[occasion] page's selection.
 */
export async function getLiveSeasonalGifts(supabase: SupabaseClient, date: Date = new Date()): Promise<SeasonalGift[]> {
  const seasonal = getSeasonalOccasions(date)
  const { data } = await supabase
    .from('collections')
    .select('occasion, hero_image_url, collection_items(count)')
    .eq('collection_type', 'gift_guide')
    .eq('is_visible', true)
    .not('published_at', 'is', null)
    .in('occasion', seasonal.map((o) => o.value))
    .order('published_at', { ascending: false })

  type Row = { occasion: string | null; hero_image_url: string | null; collection_items: { count: number }[] | null }
  const byOccasion = new Map<string, Row>()
  for (const row of (data ?? []) as Row[]) {
    if (row.occasion && !byOccasion.has(row.occasion)) byOccasion.set(row.occasion, row)
  }

  return seasonal.flatMap((occ) => {
    const row = byOccasion.get(occ.value)
    const count = row?.collection_items?.[0]?.count ?? 0
    return row && count > 0 ? [{ occ, heroImageUrl: row.hero_image_url ?? null }] : []
  })
}

/**
 * Cache tag for everything that depends on which gift guides are live. Purged
 * by `revalidateGiftGuidePaths()` (lib/revalidate.ts) from every collection
 * write path — create, edit, delete, scheduled publish.
 */
export const GIFT_GUIDES_TAG = 'gift-guides'

/**
 * The content half of the seasonal Gifts nav slot (2026-10-14). The slot is
 * earned by a LIVE seasonal guide, not by the calendar alone: in October 2026
 * the date switch lit "Gift Guides" in the masthead and footer with one
 * published guide on the whole site — June's — so the widest link in the bar
 * led to a grid of 29 "Coming soon" tiles. `isGiftSeason()` still owns the
 * window; the public layout ANDs it with this.
 *
 * Cached, hourly, tagged. The public layout asks on every page and most public
 * routes are static/ISR (`/gear` is `force-static`), so without the tag a
 * publish would light the link on the next DEPLOY rather than the next request.
 * `unstable_cache` rather than `'use cache'`: cacheComponents is not enabled.
 * No arguments on purpose — a `Date` in the key would miss the cache every call.
 */
export const hasLiveSeasonalGifts = unstable_cache(
  async () => (await getLiveSeasonalGifts(createAnonClient())).length > 0,
  ['has-live-seasonal-gifts'],
  { tags: [GIFT_GUIDES_TAG], revalidate: 3600 },
)
