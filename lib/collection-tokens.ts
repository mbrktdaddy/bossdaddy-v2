import type { SupabaseClient } from '@supabase/supabase-js'

const TOKEN_REGEX = /\[\[COLLECTION:([a-z0-9-]+)\]\]/g
const MARKER_REGEX = /<div\s+class="bd-collection-embed"\s+data-collection-slug="([a-z0-9-]+)"[^>]*>\s*<\/div>/g

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Replace every `[[COLLECTION:slug]]` token in the input HTML with a self-
 * closing marker div that survives sanitization. The render layer
 * (`splitContentForCollectionEmbeds` in the guide page) detects these markers
 * and swaps them for the <CollectionEmbed> server component.
 *
 * Unknown slugs render as a visible "[link missing]" stub so editors catch
 * mistakes instead of empty space.
 *
 * Runs at save time in the guide POST/PATCH routes, before sanitizeHtml.
 */
export async function resolveCollectionTokens(
  html: string,
  supabase: SupabaseClient,
): Promise<string> {
  const slugs = new Set<string>()
  for (const m of html.matchAll(TOKEN_REGEX)) slugs.add(m[1])
  if (slugs.size === 0) return html

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('collections')
    .select('slug')
    .in('slug', Array.from(slugs))

  if (error) console.error('resolveCollectionTokens lookup failed:', error.message)

  const known = new Set<string>(((data ?? []) as { slug: string }[]).map((row) => row.slug))

  const replaced = html.replace(TOKEN_REGEX, (_, slug: string) => {
    if (!known.has(slug)) {
      return `<span class="bd-link-missing" data-slug="${escapeHtml(slug)}">[collection missing: ${escapeHtml(slug)}]</span>`
    }
    return `<div class="bd-collection-embed" data-collection-slug="${escapeHtml(slug)}"></div>`
  })

  // TiptapEditor wraps editor text in <p> tags. When [[COLLECTION:slug]] is
  // typed as the sole content of a paragraph, the resolved <div> would end up
  // as `<p><div class="bd-collection-embed"></div></p>` — invalid HTML
  // (block-in-inline) that the browser auto-fixes by inserting an extra empty
  // <p>. Strip the wrapping <p> in that exact case so the marker stands alone.
  return replaced.replace(
    /<p>\s*(<div class="bd-collection-embed" data-collection-slug="[a-z0-9-]+"><\/div>)\s*<\/p>/g,
    '$1'
  )
}

/** Find all collection-embed markers in already-resolved HTML. */
export function extractCollectionSlugs(html: string): string[] {
  const slugs: string[] = []
  const seen = new Set<string>()
  for (const m of html.matchAll(MARKER_REGEX)) {
    if (!seen.has(m[1])) { slugs.push(m[1]); seen.add(m[1]) }
  }
  return slugs
}

export { MARKER_REGEX as COLLECTION_EMBED_MARKER_REGEX }
