import { NextResponse, type NextRequest } from 'next/server'

// Public legacy URL redirects — work for unauthenticated users too.
// Keep these in sync with sitemap.xml exclusions and any external links.
export function rewritePublicLegacy(pathname: string): string | null {
  // /shop and /shop/* → /gear (shop unified into the gear page)
  if (pathname === '/shop' || pathname === '/shop/') return '/gear'
  if (pathname.startsWith('/shop/')) return '/gear'

  // /stuff and /stuff/* → /gear (/gear is now canonical)
  if (pathname === '/stuff' || pathname === '/stuff/') return '/gear'
  if (pathname.startsWith('/stuff')) return '/gear' + pathname.slice(6)

  // /feed/articles.xml → /feed/guides.xml (RSS feed renamed)
  if (pathname === '/feed/articles.xml') return '/feed/guides.xml'

  // /wishlist and /wishlist/* → /bench (renamed to "On the Bench")
  if (pathname === '/wishlist' || pathname === '/wishlist/') return '/bench'
  const wishlistSlug = pathname.match(/^\/wishlist\/([^/]+)\/?$/)
  if (wishlistSlug) return `/bench/${wishlistSlug[1]}`

  // /tools/kids/* → /tools/family/* (the per-member hub now holds partners
  // and others too, so "kids" in the URL was user-facing-wrong). The route
  // segment moved to app/(tools)/tools/family; this 301s the old links.
  if (pathname === '/tools/kids' || pathname === '/tools/kids/') return '/tools/family'
  const kidsMember = pathname.match(/^\/tools\/kids\/([^/]+)\/?$/)
  if (kidsMember) return `/tools/family/${kidsMember[1]}`

  return null
}

// Legacy routes that redirect into the unified workspace. Public /articles
// applies to all users; /dashboard/* redirects only fire for authenticated
// users (unauthenticated will be bounced to /login by the auth guard first).
export function rewriteLegacyRoute(pathname: string): string | null {
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

  // /dashboard/{guides,reviews}/[id]/edit → workspace at /dashboard/{guides,reviews}/[id]
  const guideEdit = pathname.match(/^\/dashboard\/guides\/([^/]+)\/edit\/?$/)
  if (guideEdit) return `/dashboard/guides/${guideEdit[1]}`
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

// Returns a 301 NextResponse if the path matches a public legacy URL, else null.
export function checkPublicLegacyRewrite(request: NextRequest, pathname: string): NextResponse | null {
  const target = rewritePublicLegacy(pathname)
  if (!target) return null
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.redirect(url, { status: 301 })
}
