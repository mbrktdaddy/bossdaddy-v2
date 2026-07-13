import type { SupabaseClient } from '@supabase/supabase-js'

// [[REVIEW:slug]] and [[GUIDE:slug]] — inline "read next" cross-links between
// editorial pieces. Same save-time-resolution doctrine as [[COLLECTION:slug]]:
// the raw token is replaced with a sanitizer-safe marker div at POST/PATCH,
// and the render layer (splitContentForInlineCards) swaps the marker for the
// <ContentLinkCard> server component.
const TOKEN_REGEX = /\[\[(REVIEW|GUIDE):([a-z0-9-]+)\]\]/g
const MARKER_REGEX = /<div\s+class="bd-content-link"\s+data-content-type="(review|guide)"\s+data-content-slug="([a-z0-9-]+)"[^>]*>\s*<\/div>/g

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Replace every `[[REVIEW:slug]]` / `[[GUIDE:slug]]` token with a self-closing
 * marker div that survives sanitization. Only published + visible targets
 * resolve; anything unknown (typo, unpublished, wrong type) renders as a
 * visible "[link missing]" stub so editors catch it before publish.
 *
 * Runs at save time in the guide/review POST/PATCH routes, before sanitizeHtml.
 */
export async function resolveContentTokens(
  html: string,
  supabase: SupabaseClient,
): Promise<string> {
  const reviewSlugs = new Set<string>()
  const guideSlugs = new Set<string>()
  for (const m of html.matchAll(TOKEN_REGEX)) {
    if (m[1] === 'REVIEW') reviewSlugs.add(m[2])
    else guideSlugs.add(m[2])
  }
  if (reviewSlugs.size === 0 && guideSlugs.size === 0) return html

  const knownReviews = new Set<string>()
  const knownGuides = new Set<string>()

  await Promise.all([
    reviewSlugs.size > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('reviews')
          .select('slug')
          .eq('status', 'approved')
          .eq('is_visible', true)
          .in('slug', Array.from(reviewSlugs))
          .then(({ data, error }: { data: { slug: string }[] | null; error: { message: string } | null }) => {
            if (error) console.error('resolveContentTokens review lookup failed:', error.message)
            for (const row of data ?? []) knownReviews.add(row.slug)
          })
      : Promise.resolve(),
    guideSlugs.size > 0
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from('guides')
          .select('slug')
          .eq('status', 'approved')
          .eq('is_visible', true)
          .in('slug', Array.from(guideSlugs))
          .then(({ data, error }: { data: { slug: string }[] | null; error: { message: string } | null }) => {
            if (error) console.error('resolveContentTokens guide lookup failed:', error.message)
            for (const row of data ?? []) knownGuides.add(row.slug)
          })
      : Promise.resolve(),
  ])

  const replaced = html.replace(TOKEN_REGEX, (_, kind: string, slug: string) => {
    const type = kind === 'REVIEW' ? 'review' : 'guide'
    const known = type === 'review' ? knownReviews.has(slug) : knownGuides.has(slug)
    if (!known) {
      return `<span class="bd-link-missing" data-slug="${escapeHtml(slug)}">[${type} missing: ${escapeHtml(slug)}]</span>`
    }
    return `<div class="bd-content-link" data-content-type="${type}" data-content-slug="${escapeHtml(slug)}"></div>`
  })

  // TiptapEditor wraps text in <p>. A marker that was the sole child of a
  // paragraph becomes invalid `<p><div…></div></p>` (block-in-inline) which the
  // browser auto-splits — strip the wrapping <p> in that exact case.
  return replaced.replace(
    /<p>\s*(<div class="bd-content-link" data-content-type="(?:review|guide)" data-content-slug="[a-z0-9-]+"><\/div>)\s*<\/p>/g,
    '$1',
  )
}

export { MARKER_REGEX as CONTENT_LINK_MARKER_REGEX }
