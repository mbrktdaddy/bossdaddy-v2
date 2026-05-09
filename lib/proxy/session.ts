import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'

// Refreshes the Supabase session cookie and returns the supabase client +
// current user + a response object pre-populated with refreshed cookies.
//
// MUST run before any auth-aware middleware. Wraps auth.getUser() in
// try/catch because a stale or invalid refresh token throws AuthApiError,
// which would otherwise crash the middleware and surface as a generic 500
// HTML error page on every request (including API routes).
export async function refreshSession(request: NextRequest): Promise<{
  supabase: SupabaseClient
  user: User | null
  response: NextResponse
}> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user: User | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch (err) {
    console.error('proxy auth.getUser failed (treating as logged out):', err)
    // Clear the bad session cookies so the next request starts fresh
    request.cookies.getAll().forEach((c) => {
      if (c.name.startsWith('sb-') && c.name.endsWith('-auth-token')) {
        response.cookies.delete(c.name)
      }
    })
  }

  return { supabase, user, response }
}
