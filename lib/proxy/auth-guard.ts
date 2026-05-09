import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { rewriteLegacyRoute } from './rewrites'

// Non-admins who hit /dashboard get bounced to this page (a safe public page).
const NON_ADMIN_HOME = '/'

// Routes available only to admins (everything in /dashboard except /profile).
function isAdminRoute(pathname: string) {
  return pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/profile')
}

// Combined auth/route gates: dashboard auth requirement, legacy route 301s,
// admin role check for /dashboard, and bounce for already-signed-in users
// hitting /login or /register. Order matters — auth guard fires first so
// unauthenticated /dashboard hits don't reveal route shape via the legacy
// rewriter.
export async function checkAuthGuard(args: {
  request: NextRequest
  pathname: string
  supabase: SupabaseClient
  user: User | null
}): Promise<NextResponse | null> {
  const { request, pathname, supabase, user } = args

  // 1. /dashboard requires auth
  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // 2. Legacy route redirects — public /articles applies to everyone; /dashboard
  // legacy redirects only fire for authenticated users (guests were bounced above).
  const rewrite = rewriteLegacyRoute(pathname)
  if (rewrite && (user || !pathname.startsWith('/dashboard'))) {
    const url = request.nextUrl.clone()
    url.pathname = rewrite
    return NextResponse.redirect(url, { status: 301 })
  }

  // 3. Admin-only dashboard routes (except /dashboard/profile)
  if (isAdminRoute(pathname) && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = NON_ADMIN_HOME
      return NextResponse.redirect(url)
    }
  }

  // 4. Already signed in? Bounce away from /login and /register.
  if ((pathname === '/login' || pathname === '/register') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return null
}
