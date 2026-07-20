import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Cookie-free, RLS-respecting Supabase client for PUBLIC data reads on
 * statically-prerendered / ISR pages.
 *
 * Unlike the SSR client in ./server.ts, this never calls next/headers
 * `cookies()`, so it does NOT opt the route into dynamic rendering — the
 * cookie read is exactly what forces the whole revenue/SEO surface to render
 * ƒ (dynamic) instead of ○/● (static). See docs/audit-2026-07-19.md H3 and the
 * `picks/[slug]` cookie-free precedent.
 *
 * It authenticates as the `anon` role, so it can only read rows exposed by
 * "to anon" RLS policies (approved reviews/guides, visible products &
 * collections, approved comments, public profiles) — i.e. exactly what a
 * logged-out visitor and a crawler already see. That equivalence is what makes
 * swapping server.ts→anon.ts on public pages behaviorally a no-op: an
 * anonymous request through the SSR client already runs as `anon` today.
 *
 * NEVER use this for per-user data or writes. Use ./server.ts (cookie session)
 * for anything request/user-scoped, or ./admin.ts (service role) for trusted
 * server operations that must bypass RLS.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
