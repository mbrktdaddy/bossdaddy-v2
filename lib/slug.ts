import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './supabase/database.types'

/**
 * Slugify a title: lowercase, ASCII-only, hyphen-separated, capped at 75 chars
 * with word-boundary truncation. Diacritics are normalized (ü→u) and
 * apostrophes are dropped (don't → dont) so they don't create awkward dashes.
 */
const SLUG_MAX = 75

export function slugifyTitle(title: string): string {
  let slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip diacritics (ü, ñ, é → u, n, e)
    .replace(/['’]/g, '')         // strip straight + curly apostrophes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  if (slug.length > SLUG_MAX) {
    const truncated = slug.slice(0, SLUG_MAX)
    const lastDash = truncated.lastIndexOf('-')
    slug = lastDash > 40 ? truncated.slice(0, lastDash) : truncated
  }

  return slug
}

/**
 * Generate a unique slug for a row in `table` based on `title`.
 *
 * Returns the slugified base if available, otherwise base-2, base-3, etc.
 * Single round-trip: queries existing slugs that match the base, computes the
 * next available counter in memory.
 *
 * Race condition: two concurrent calls with the same title may both pick the
 * same candidate. The caller should still handle Postgres unique-violation
 * (23505) on insert as a fallback.
 */
export async function generateUniqueSlug(
  supabase: SupabaseClient<Database>,
  table: 'reviews' | 'guides',
  title: string
): Promise<string> {
  const base = slugifyTitle(title)

  const { data: existing } = await supabase
    .from(table)
    .select('slug')
    .or(`slug.eq.${base},slug.like.${base}-%`)

  const taken = new Set((existing ?? []).map((r) => r.slug))
  if (!taken.has(base)) return base

  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}
