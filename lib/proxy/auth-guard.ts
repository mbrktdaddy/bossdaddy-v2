import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { rewriteLegacyRoute } from './rewrites'

// Members hitting the dashboard get their own account settings page.
const MEMBER_ACCOUNT = '/account/settings'

// Admin-only dashboard surfaces. Authors AND members are blocked from these.
// Three pages live outside /dashboard/admin/ for historical reasons — list them
// explicitly so the gate stays correct when new admin pages are added.
const ADMIN_ONLY_PATHS = [
  '/dashboard/admin/',   // canonical admin namespace
  '/dashboard/users',    // user/role management
  '/dashboard/comments', // comment moderation
  '/dashboard/social',   // social posts
] as const

function isAdminOnlyRoute(pathname: string) {
  return ADMIN_ONLY_PATHS.some(p => {
    const base = p.replace(/\/$/, '')
    // Exact match (e.g. /dashboard/users) OR a subpath (e.g. /dashboard/users/123),
    // but NOT a sibling that happens to share a prefix (e.g. /dashboard/users-export).
    return pathname === base || pathname.startsWith(base + '/')
  })
}

// Author-or-admin routes: everything in /dashboard (members have no CMS access).
function needsAuthorOrAdmin(pathname: string) {
  return pathname.startsWith('/dashboard') && !isAdminOnlyRoute(pathname)
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

  // 3. Role-tier dashboard gates (skip /dashboard/profile — any authed user OK).
  //
  //   /dashboard/admin/* + users/comments/social  → admin only
  //   /dashboard/* (everything else)              → author or admin
  //   /dashboard/profile                          → any authenticated user (no role check)
  if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/profile')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role
    const blocked =
      (isAdminOnlyRoute(pathname) && role !== 'admin') ||
      (needsAuthorOrAdmin(pathname) && role !== 'admin' && role !== 'author')

    if (blocked) {
      const url = request.nextUrl.clone()
      url.pathname = isAdminOnlyRoute(pathname) ? '/' : MEMBER_ACCOUNT
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
