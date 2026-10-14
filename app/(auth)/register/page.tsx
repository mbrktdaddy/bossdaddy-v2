'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { claimAnonymousData } from '@/lib/dad-tools/kid-actions'
import { claimMyPendingInvites } from '@/lib/dad-tools/savings-actions'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

export default function RegisterPage() {
  // The heading lockup sits OUTSIDE the Suspense: only the form reads
  // useSearchParams, so the page title paints immediately instead of waiting on it.
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow={LABELS.auth.register.eyebrow}
        title={LABELS.auth.register.h1}
        deck="Create your Boss Daddy account"
        className="mb-6"
      />
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </>
  )
}

function RegisterForm() {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  // Only allow relative paths to prevent open-redirect.
  // Reject protocol-relative URLs like //evil.com which browsers resolve
  // to https://evil.com — phishing vector even though startsWith('/') passes.
  const redirectTo =
    nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
      ? nextParam
      : '/'

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        // FALLBACK ONLY. The Confirm-signup template links to /confirm with a
        // {{ .TokenHash }}, so this value is not used while that template is in
        // place — the template's href wins.
        //
        // It exists because of what happened on 2026-08-16: with no
        // emailRedirectTo, Supabase fell back to the dashboard Site URL, so the
        // link carried `redirect_to=https://www.bossdaddylife.com/`. Supabase
        // appends `?code=…` to that, the homepage has no exchange handler, and
        // the code was silently discarded — email marked confirmed, user landed
        // logged OUT. If the template is ever reverted to {{ .ConfirmationURL }},
        // this sends the code to /callback, which actually exchanges it.
        //
        // NEXT_PUBLIC_SITE_URL (not window.location.origin) so the canonical www
        // host is used even if the visitor typed the apex — the redirect target
        // has to match Supabase's allowlist exactly.
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/callback?next=/dashboard`,
      },
    })

    if (error) {
      if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
        setError('already_exists')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    // Supabase returns user: null when the email is already registered
    // (silent duplicate to prevent enumeration)
    if (!data.user) {
      setError('already_exists')
      setLoading(false)
      return
    }

    // Migrate any anonymous Dad Tools data (kids, intent events, email subs)
    // that was created against the bd_anon_id cookie into this new user.
    // Best-effort: non-fatal if it fails. No-op when there's no cookie or
    // when email confirmation is required (session not yet established) —
    // in that case the next successful login will run the claim instead.
    if (data.session) {
      try {
        const claim = await claimAnonymousData()
        if (!claim.ok) {
          console.warn('claim-on-signup (register) returned not-ok:', claim.error)
        }
      } catch (err) {
        console.warn('claim-on-signup (register) threw:', err)
      }
      // Relay any pending savings-goal email invites to in-app notifications.
      try { await claimMyPendingInvites() } catch (err) { console.warn('invite claim (register) threw:', err) }
    }

    // Hard navigation — same reasoning as login: forces a fresh server
    // render with the new auth cookie. router.push() is fragile on mobile
    // and PWA standalone mode.
    window.location.assign(redirectTo)
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Username"
          autoComplete="off"
          id="username"
          type="text"
          required
          minLength={3}
          value={username}
          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
          placeholder="bossdad42"
        />

        <Field
          label="Email"
          autoComplete="username"
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <Field
          label="Password"
          autoComplete="new-password"
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8+ characters"
        />

        {error && (
          <div role="alert" className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-md px-4 py-3">
            {error === 'already_exists' ? (
              <p>
                An account with that email already exists.{' '}
                {/* Danger ink, not the accent link colour — orange on the pale
                    danger fill is thin. py + -my = 44px hit area, no growth. */}
                <Link
                  href={`/login?next=${encodeURIComponent(redirectTo)}`}
                  className="inline-block py-3 -my-3 font-semibold underline underline-offset-2 hover:no-underline"
                >
                  Sign in instead →
                </Link>
              </p>
            ) : (
              <p>{error}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={buttonVariants({ className: 'w-full' })}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-prose-faint">
        Already have an account?{' '}
        <Link href="/login" className="inline-block py-3 -my-3 font-semibold text-accent-text hover:text-accent">
          Sign in
        </Link>
      </p>
    </>
  )
}
