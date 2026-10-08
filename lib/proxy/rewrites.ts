import { NextResponse, type NextRequest } from 'next/server'

// Renamed category slugs → current slug. Category slugs are URL segments on
// five route families (/category, /gear/category, /guides/category,
// /reviews/category, /feed/category), so a rename in lib/categories.ts must
// land here too or every indexed URL 404s.
//
// Per the Naming Doctrine, renaming a slug is only justified when the
// user-facing URL is actually wrong — add the old → new pair here, never drop
// the old one.
const LEGACY_CATEGORY_SLUGS: Record<string, string> = {
  // Relabeled "Tech & EDC" → "Tech & Gadgets"; the slug was left stale and
  // contradicted the label everywhere it appeared in a URL.
  'tech-edc': 'tech-gadgets',
}

// Real single-segment routes under /gear. Anything else at /gear/<x> is a
// pre-split merch URL and 301s to /shop/<x>. `radar` is reserved for the
// planned On the Radar archive (/gear/radar).
const GEAR_ROUTES = new Set(['category', 'radar'])

// Public legacy URL redirects — work for unauthenticated users too.
// Keep these in sync with sitemap.xml exclusions and any external links.
export function rewritePublicLegacy(pathname: string): string | null {
  // Renamed category slugs, across every /…/category/<slug> route family.
  const category = pathname.match(/^(|\/gear|\/guides|\/reviews|\/feed)\/category\/([^/]+)\/?$/)
  if (category) {
    const renamed = LEGACY_CATEGORY_SLUGS[category[2]]
    if (renamed) return `${category[1]}/category/${renamed}`
  }

  // /gear/<merch-slug> → /shop/<merch-slug>. The store split back out of /gear
  // on 2026-09-29 (it had been merged in, and /shop 301'd here). /gear/[slug]
  // only ever served the `merch` table, so every single-segment /gear path that
  // isn't a real /gear route is an old store link. Add new /gear sub-routes to
  // GEAR_ROUTES or this will redirect them to the shop.
  const gearSlug = pathname.match(/^\/gear\/([^/]+)\/?$/)
  if (gearSlug && !GEAR_ROUTES.has(gearSlug[1])) return `/shop/${gearSlug[1]}`

  // /stuff was the old display name for the PRODUCTS page, so /stuff/<product>
  // is a product link, not merch. A product's page is its bench page, which
  // 307s on to the review once one is published (slug-redirect.ts). This used
  // to send /stuff/<product> to /gear/<product>, a merch lookup that 404'd.
  if (pathname === '/stuff' || pathname === '/stuff/') return '/gear'
  const stuffCategory = pathname.match(/^\/stuff\/category\/([^/]+)\/?$/)
  if (stuffCategory) return `/gear/category/${stuffCategory[1]}`
  const stuffSlug = pathname.match(/^\/stuff\/([^/]+)\/?$/)
  if (stuffSlug) return `/bench/${stuffSlug[1]}`
  if (pathname.startsWith('/stuff/')) return '/gear'

  // /feed/articles.xml → /feed/guides.xml (RSS feed renamed)
  if (pathname === '/feed/articles.xml') return '/feed/guides.xml'

  // /wishlist and /wishlist/* → /bench (renamed to "On the Bench")
  if (pathname === '/wishlist' || pathname === '/wishlist/') return '/bench'
  const wishlistSlug = pathname.match(/^\/wishlist\/([^/]+)\/?$/)
  if (wishlistSlug) return `/bench/${wishlistSlug[1]}`

  // /goals/shared → /goals#corner. The list of goals other people share with you
  // folded into /goals as a second group (nav-ia-plan Phase E) — it was a whole page
  // reached by a link gated on a non-zero count, so it could vanish from the app.
  //
  // EXACT PATH ONLY. /goals/shared/[id] is still a real page and the only way a
  // partner reads a goal he's supporting; a prefix match here would break every one
  // of those links, including the ones sitting in goal_note notification rows.
  if (pathname === '/goals/shared' || pathname === '/goals/shared/') return '/goals'

  // /tools/kids/* → /tools/family/* (the per-member hub now holds partners
  // and others too, so "kids" in the URL was user-facing-wrong). The route
  // segment moved to app/(public)/tools/family; this 301s the old links.
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

// The Vault hub is gone (nav-ia-plan Phase I-4, 2026-10-08): /vault 301s to
// /gear. A `?tab=` from the hub's even older client-side tab state still lands
// on that tab's real page so no old link degrades to the hub's replacement.
const LEGACY_VAULT_TABS: Record<string, string> = {
  comparisons: '/comparisons',
  'best-of':   '/picks',
  gifts:       '/gifts',
  stacks:      '/stacks',
}

export function rewriteLegacyVaultTab(pathname: string, tab: string | null): string | null {
  if (pathname !== '/vault' && pathname !== '/vault/') return null
  return (tab && LEGACY_VAULT_TABS[tab]) || '/gear'
}

// Returns a 301 NextResponse if the path matches a public legacy URL, else null.
export function checkPublicLegacyRewrite(request: NextRequest, pathname: string): NextResponse | null {
  const vaultTab = rewriteLegacyVaultTab(pathname, request.nextUrl.searchParams.get('tab'))
  if (vaultTab) {
    const url = request.nextUrl.clone()
    url.pathname = vaultTab
    url.searchParams.delete('tab')
    return NextResponse.redirect(url, { status: 301 })
  }

  const target = rewritePublicLegacy(pathname)
  if (!target) return null
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.redirect(url, { status: 301 })
}
