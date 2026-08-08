// THIS FILE MUST BE NAMED proxy.ts — Next.js 16 uses proxy.ts as the
// middleware entry point (renamed from middleware.ts in earlier versions).
// Do NOT rename to middleware.ts and do NOT create a middleware.ts alongside
// this file — either will break the build or silently disable auth protection.
//
// This file is the orchestrator for the request-lifecycle pipeline. Each
// concern lives in its own module under lib/proxy/ and returns either a
// NextResponse (early exit) or null (pass through). Order matters — see
// individual modules for the rationale on each step's position.
import { type NextRequest } from 'next/server'
import { checkCanonicalHost } from '@/lib/proxy/canonical-host'
import { refreshSession } from '@/lib/proxy/session'
import { checkModerationGate } from '@/lib/proxy/moderation'
import { checkPublicLegacyRewrite } from '@/lib/proxy/rewrites'
import { checkSlugRedirect } from '@/lib/proxy/slug-redirect'
import { checkAuthGuard } from '@/lib/proxy/auth-guard'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 0. Canonical host (apex → www) — short-circuit before any DB/session work.
  const canonical = checkCanonicalHost(request)
  if (canonical) return canonical

  // 1. Refresh session — must run first so subsequent steps see the user.
  const { supabase, user, response } = await refreshSession(request)

  // 2. Block suspended/banned users early — they shouldn't reach any page.
  const moderation = await checkModerationGate({ request, pathname, supabase, user })
  if (moderation) return moderation

  // 3. Public legacy URL 301s (no DB).
  const publicLegacy = checkPublicLegacyRewrite(request, pathname)
  if (publicLegacy) return publicLegacy

  // 4. DB-backed slug 301s (legacy_slugs[] lookup on /reviews/* and /guides/*).
  const slug = await checkSlugRedirect({ request, pathname, supabase })
  if (slug) return slug

  // 5. /dashboard auth, legacy route 301s, admin gate, signed-in bounces.
  const authGuard = await checkAuthGuard({ request, pathname, supabase, user })
  if (authGuard) return authGuard

  return response
}

// Also excluded: robots.txt, sitemap.xml and manifest.webmanifest. They are
// crawler-facing files with no session to refresh, and running the pipeline on
// them spends a Supabase round-trip per crawl — and would attach Set-Cookie to a
// response that ought to stay cacheable.
//
// `og-card`/`img-crop` (and the `api/og`/`api/img` routes they rewrite onto) are
// PUBLIC IMAGE endpoints, not app routes. They were
// matching this proxy only because they carry no file extension, so every social
// preview render paid a Supabase refreshSession() round-trip plus a
// checkModerationGate() DB query before the image work even started — latency on
// the one path where a crawler timeout costs a broken card for ~7 days. Worse, if
// such a request ever arrived with cookies, the session refresh would attach
// Set-Cookie and make the response uncacheable at the CDN. Nothing in the
// pipeline applies to them: they take no session, serve no user data, and must
// stay reachable while logged out. (The `api/og` prefix also covers
// `api/og/weekends`.)
// `api/goals/calendar` is excluded for the same reasons, plus one of its own. The
// callers are Google's and Apple's calendar servers polling an .ics feed every few
// hours, and they authenticate with the TOKEN IN THE PATH — never a cookie. So the
// session refresh here is pure latency on a request that can't use it, and if such a
// request ever did arrive with cookies, refreshSession() would attach Set-Cookie to
// a response the route deliberately marks `private, no-store`. Excluding it also
// keeps the token lookup in the route as the single, obvious authorization for that
// feed rather than something a reader might assume the proxy participates in.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|og-card|img-crop|api/og|api/img|api/goals/calendar|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
