// The one merged recency index — "what's new here, across every content type".
//
// Both the homepage's Latest rail and the Explore page answer that question, and
// both used to (or would have) rebuilt the same merge inline: map each table's
// rows into one shape, drop anything undated, sort newest first, slice. Keeping
// it here means the two surfaces can't drift on the ordering rule.
//
// Sorted on the raw ISO strings: they're same-format and UTC out of Postgres, so
// lexical order IS chronological order, and it avoids constructing Dates during
// render.

export interface LatestItem {
  /** Content-FORMAT role label — "Review", "Guide", "Comparison", "Best Of".
   *  Never the category: on a mixed index the format is the distinction that
   *  isn't already in the headline. */
  kind: string
  title: string
  href: string
  published_at: string | null
  /** Category slug, when the surface wants to show the topic beside the format
   *  (Explore's rows do; the homepage's text rail doesn't). */
  category?: string | null
  excerpt?: string | null
  imageUrl?: string | null
}

/** Newest first, undated items dropped, capped at `slots`. */
export function mergeByRecency<T extends { published_at: string | null }>(items: T[], slots: number): (T & { published_at: string })[] {
  return items
    .filter((i): i is T & { published_at: string } => Boolean(i.published_at))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, slots)
}

/**
 * The site's one published-date format. `short` ("Oct 8") for rails and chips,
 * `long` ("Oct 8, 2026") for row meta and lead cards. UTC on purpose: the stored
 * timestamp is the publication instant and must not shift a day on render.
 */
export function formatPublished(iso: string | null | undefined, style: 'short' | 'long' = 'long'): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  })
}
