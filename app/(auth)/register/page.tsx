'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { claimAnonymousData } from '@/lib/dad-tools/kid-actions'
import { claimMyPendingInvites } from '@/lib/dad-tools/savings-actions'

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
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
      options: { data: { username } },
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
    <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-prose mb-2">Join the Crew</h1>
        <p className="text-prose-muted mb-8 text-sm">Create your Boss Daddy account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-prose-muted mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="bossdad42"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-prose-muted mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-prose-muted mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="8+ characters"
            />
          </div>

          {error && (
            <div className="text-sm bg-red-50 border border-red-300 rounded-lg px-4 py-3">
              {error === 'already_exists' ? (
                <p className="text-red-700">
                  An account with that email already exists.{' '}
                  <Link href={`/login?next=${encodeURIComponent(redirectTo)}`} className="text-accent-text-soft hover:text-accent font-semibold">
                    Sign in instead →
                  </Link>
                </p>
              ) : (
                <p className="text-red-700">{error}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-prose-faint">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-text-soft hover:text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
