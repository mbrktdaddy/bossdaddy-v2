import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Slug-cleanup Phase 2 (2026-05-08): redirect old slugs to clean ones via
// reviews.legacy_slugs[] / guides.legacy_slugs[]. Server Component
// permanentRedirect() gets swallowed by Sentry instrumentation, so we do
// the 301 here in proxy instead.
//
// The lookup uses a GIN index on legacy_slugs[]; cost is ~5-15ms per
// /reviews/* and /guides/* hit. We can't easily gate by suffix pattern
// because legacy slugs vary (8 hex, 4 alphanumeric, or no suffix at all
// when only the title was edited).
export async function checkSlugRedirect(args: {
  request: NextRequest
  pathname: string
  supabase: SupabaseClient
}): Promise<NextResponse | null> {
  const { request, pathname, supabase } = args

  const reviewMatch = pathname.match(/^\/reviews\/([^/]+)\/?$/)
  if (reviewMatch) return lookupAndRedirect(supabase, request, 'reviews', reviewMatch[1])

  const guideMatch = pathname.match(/^\/guides\/([^/]+)\/?$/)
  if (guideMatch) return lookupAndRedirect(supabase, request, 'guides', guideMatch[1])

  const benchMatch = pathname.match(/^\/bench\/([^/]+)\/?$/)
  if (benchMatch) return benchToReview(supabase, request, benchMatch[1])

  return null
}

// A bench item that graduated has one destination: its review. Otherwise the
// product has two pages (the noindex bench page + the review) and old shared
// bench links strand readers on the stale one. Mig 111 guarantees at most one
// TOP-LEVEL review per product (follow-ups share the slug, hence the parent
// filter). 307, not 301: bench pages are noindex so nothing is lost in search,
// and a review that's ever unpublished must not leave a cached permanent
// redirect in readers' browsers.
async function benchToReview(
  supabase: SupabaseClient,
  request: NextRequest,
  productSlug: string,
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from('reviews')
    .select('slug')
    .eq('product_slug', productSlug)
    .is('parent_review_id', null)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .maybeSingle()

  if (!data?.slug) return null
  const url = request.nextUrl.clone()
  url.pathname = `/reviews/${data.slug}`
  return NextResponse.redirect(url, { status: 307 })
}

async function lookupAndRedirect(
  supabase: SupabaseClient,
  request: NextRequest,
  table: 'reviews' | 'guides',
  slugCandidate: string,
): Promise<NextResponse | null> {
  const { data } = await supabase
    .from(table)
    .select('slug')
    .contains('legacy_slugs', [slugCandidate])
    .eq('status', 'approved')
    .eq('is_visible', true)
    .maybeSingle()

  if (data?.slug && data.slug !== slugCandidate) {
    const url = request.nextUrl.clone()
    url.pathname = `/${table}/${data.slug}`
    return NextResponse.redirect(url, { status: 301 })
  }
  return null
}
