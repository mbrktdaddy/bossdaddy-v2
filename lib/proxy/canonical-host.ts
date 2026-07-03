import { NextResponse, type NextRequest } from 'next/server'

// Canonical host: redirect the bare apex (bossdaddylife.com) to the primary
// www host so scrapers/search treat one URL per page. Social + search caches
// key on the EXACT URL, so apex and www shares would otherwise get separate
// (and divergent) previews.
//
// Guarded to fire ONLY on the exact apex host — www, *.vercel.app preview
// deploys, and localhost pass straight through, so there's no redirect loop and
// previews/dev are untouched. If Vercel already redirects apex→www at the edge,
// this never even sees an apex request; it's a safe belt-and-suspenders.
const APEX_HOST = 'bossdaddylife.com'
const PRIMARY_HOST = 'www.bossdaddylife.com'

export function checkCanonicalHost(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host')
  if (host !== APEX_HOST) return null

  const url = request.nextUrl.clone()
  url.protocol = 'https:'
  url.host = PRIMARY_HOST
  url.port = ''
  return NextResponse.redirect(url, 308)
}
