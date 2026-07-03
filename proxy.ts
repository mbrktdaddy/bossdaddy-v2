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

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
