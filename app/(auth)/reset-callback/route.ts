// LEGACY — kept alive only for reset links already sitting in inboxes.
//
// New Reset-Password emails link to /confirm?type=recovery, which uses
// verifyOtp({ token_hash }) instead of the PKCE exchange below. The PKCE flow
// needs the code verifier from the browser that called resetPasswordForEmail(),
// so it fails whenever the email is opened on another device — or, on this
// project, when the installed PWA captures the link into the app window. Since
// people reset passwords precisely when they're locked out somewhere else, that
// was the common path, not the edge case.
//
// Safe to delete once no pre-2026-08-16 reset emails can still be clicked
// (Supabase recovery links expire well inside 24h).
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=invalid_link`)
}
