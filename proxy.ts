import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Non-admins who hit /dashboard get bounced to this page (a safe public page).
const NON_ADMIN_HOME = '/'

// Routes available only to admins (everything in /dashboard except /profile).
function isAdminRoute(pathname: string) {
  return pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/profile')
}

// Public legacy redirects (work for unauthenticated users too).
function rewritePublicLegacy(pathname: string): string | null {
  // /shop and /shop/* → /stuff (Shop unified into the Stuff page)
  if (pathname === '/shop' || pathname === '/shop/') return '/stuff'
  if (pathname.startsWith('/shop/')) return '/stuff'
  // /gear and /gear/* → /stuff (renamed)
  if (pathname === '/gear' || pathname === '/gear/') return '/stuff'
  if (pathname.startsWith('/gear')) return '/stuff' + pathname.slice(5)
  // /feed/articles.xml → /feed/guides.xml (RSS feed renamed)
  if (pathname === '/feed/articles.xml') return '/feed/guides.xml'
  // /wishlist and /wishlist/* → /bench (renamed to "On the Bench")
  if (pathname === '/wishlist' || pathname === '/wishlist/') return '/bench'
  const wishlistSlug = pathname.match(/^\/wishlist\/([^/]+)\/?$/)
  if (wishlistSlug) return `/bench/${wishlistSlug[1]}`
  return null
}

// Legacy routes that now redirect to the unified workspace.
function rewriteLegacyRoute(pathname: string): string | null {
  // Public /articles/* → /guides/* (SEO 301 redirects)
  if (pathname === '/articles') return '/guides'
  const articleSlug = pathname.match(/^\/articles\/([^/]+)\/?$/)
  if (articleSlug) return `/guides/${articleSlug[1]}`

  // /dashboard/articles/* → /dashboard/guides/*
  if (pathname === '/dashboard/articles') return '/dashboard/guides'
  const dashArticle = pathname.match(/^\/dashboard\/articles\/(.+)$/)
  if (dashArticle) return `/dashboard/guides/${dashArticle[1]}`

  // /dashboard/admin/shop/* → /dashboard/admin/merch/*
  if (pathname === '/dashboard/admin/shop') return '/dashboard/admin/merch'
  const dashAdminShop = pathname.match(/^\/dashboard\/admin\/shop\/(.+)$/)
  if (dashAdminShop) return `/dashboard/admin/merch/${dashAdminShop[1]}`

  // /dashboard/guides/[id]/edit → /dashboard/guides/[id]
  const guideEdit = pathname.match(/^\/dashboard\/guides\/([^/]+)\/edit\/?$/)
  if (guideEdit) return `/dashboard/guides/${guideEdit[1]}`

  // /dashboard/reviews/[id]/edit → /dashboard/reviews/[id]
  const reviewEdit = pathname.match(/^\/dashboard\/reviews\/([^/]+)\/edit\/?$/)
  if (reviewEdit) return `/dashboard/reviews/${reviewEdit[1]}`

  // /dashboard/moderation/* → unified workspace
  const modGuide = pathname.match(/^\/dashboard\/moderation\/articles\/([^/]+)\/?$/)
  if (modGuide) return `/dashboard/guides/${modGuide[1]}`
  const modReview = pathname.match(/^\/dashboard\/moderation\/([^/]+)\/?$/)
  if (modReview) return `/dashboard/reviews/${modReview[1]}`
  if (pathname === '/dashboard/moderation' || pathname.startsWith('/dashboard/moderation/')) {
    return '/dashboard'
  }

  return null
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST happen before any auth checks — refreshes the session token.
  // Wrap in try/catch because a stale/invalid refresh token throws AuthApiError,
  // which would otherwise crash the middleware and surface as a generic 500
  // HTML error page on every request (including API routes).
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('middleware auth.getUser failed (treating as logged out):', err)
    // Clear the bad session cookies so the next request starts fresh
    const all = request.cookies.getAll()
    all.forEach((c) => {
      if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
        supabaseResponse.cookies.delete(c.name)
      }
    })
  }

  const { pathname } = request.nextUrl

  // Public legacy redirects (run before any auth checks — works for guests)
  const publicRewrite = rewritePublicLegacy(pathname)
  if (publicRewrite) {
    const url = request.nextUrl.clone()
    url.pathname = publicRewrite
    return NextResponse.redirect(url, { status: 301 })
  }

  // Redirect unauthenticated users away from protected routes
  if (pathname.startsWith('/dashboard') && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Handle legacy route redirects — public /articles redirects apply to all users;
  // dashboard redirects only apply to authenticated users (unauthenticated will be
  // bounced to /login by the guard above before reaching dashboard paths).
  const rewrite = rewriteLegacyRoute(pathname)
  if (rewrite && (user || !pathname.startsWith('/dashboard'))) {
    const url = request.nextUrl.clone()
    url.pathname = rewrite
    return NextResponse.redirect(url, { status: 301 })
  }

  // Admin-only dashboard (except profile which is self-serve for any authed user)
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

  // Redirect logged-in users away from auth pages
  if ((pathname === '/login' || pathname === '/register') && user) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
