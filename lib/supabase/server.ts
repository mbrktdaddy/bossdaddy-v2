import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies cannot be set.
            // Middleware handles session refresh, so this is safe to ignore.
          }
        },
      },
    }
  )
}

/**
 * Safe wrapper around `supabase.auth.getUser()` that never throws.
 * Supabase raises AuthApiError when a refresh token is stale/invalid,
 * which — if left uncaught — crashes the handler and returns a generic
 * Vercel 500 HTML page. This wrapper normalises that to `{ user: null }`,
 * which route handlers already know how to deal with (return 401).
 */
export async function getUserSafe(
  supabase: Awaited<ReturnType<typeof createClient>> | SupabaseClient
): Promise<{ user: Awaited<ReturnType<SupabaseClient['auth']['getUser']>>['data']['user'] }> {
  try {
    const { data } = await supabase.auth.getUser()
    return { user: data.user }
  } catch (err) {
    console.error('getUserSafe: auth.getUser threw, treating as logged out:', err)
    return { user: null }
  }
}
