// Email link handler — signup confirmation, password recovery, email change,
// magic links. GET /confirm?token_hash=...&type=...&next=/dashboard
//
// WHY THIS EXISTS (and why it is NOT /callback)
//
// /callback and /reset-callback use exchangeCodeForSession(code), which is the
// PKCE flow: Supabase issues a `pkce_…` token and the matching code VERIFIER is
// stored in the browser that called signUp()/resetPasswordForEmail(). That works
// for OAuth, where the same tab finishes what it started. It is the wrong tool
// for an email link, because email is opened wherever the person happens to be:
//
//   • sign up on a laptop, confirm on an Android phone → no verifier on the
//     phone → exchange fails → dumped at /login?error=auth_callback_failed
//   • worse for password RESET, since people reset precisely when they are
//     locked out on some other device
//   • and on this project specifically, an installed PWA with `scope: '/'` and
//     no launch_handler (app/manifest.ts) captures links into the app window,
//     so even a same-laptop click can land in a different client context than
//     the one holding the verifier
//
// verifyOtp({ token_hash, type }) has no verifier to look up — the token is
// self-contained and verified server-side. It therefore works from any browser,
// any device, and inside the PWA surface. This is Supabase's documented pattern
// for email links.
//
// The session lands as Set-Cookie on this route's redirect RESPONSE, so there is
// no client-side navigation for a service worker to interfere with — the same
// reason sign-in uses a hard nav rather than router.push().
//
// Requires the Supabase email templates to link here with {{ .TokenHash }}:
//   Confirm signup:  {{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
//   Reset Password:  {{ .SiteURL }}/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

// Allowlist rather than a bare cast. `type` arrives from a query string, and
// handing an arbitrary value to verifyOtp() would mean trusting user input to
// name an auth flow.
const EMAIL_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const

function parseType(raw: string | null): EmailOtpType | null {
  return EMAIL_OTP_TYPES.includes(raw as (typeof EMAIL_OTP_TYPES)[number])
    ? (raw as EmailOtpType)
    : null
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = parseType(searchParams.get('type'))

  // Same open-redirect guard as /callback: only same-origin relative paths.
  // `//evil.com` passes startsWith('/') but browsers resolve it to a full URL.
  const rawNext = searchParams.get('next')
  const next =
    rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/'

  // A recovery failure belongs on /forgot-password (where a new link can be
  // requested), everything else on /login. Sending a locked-out user to a login
  // form they cannot complete is the dead end we just got rid of.
  const failure = (reason: string) =>
    type === 'recovery'
      ? `${origin}/forgot-password?error=${reason}`
      : `${origin}/login?error=${reason}`

  if (!tokenHash || !type) {
    return NextResponse.redirect(failure('invalid_link'))
  }

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

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

  if (error) {
    // Single-use tokens: a second click on the same link lands here, as does a
    // genuinely expired one. Both read as "expired" to the user, which is
    // accurate — unlike the old copy, which said "expired" whenever there was
    // simply no session.
    console.warn(`[confirm] verifyOtp failed (type=${type}):`, error.message)
    return NextResponse.redirect(failure('link_expired'))
  }

  return NextResponse.redirect(`${origin}${next}`)
}
