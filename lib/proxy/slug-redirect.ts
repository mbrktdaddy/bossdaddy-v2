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

  return null
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
