'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { claimAnonymousData } from '@/lib/dad-tools/kid-actions'
import { claimMyPendingInvites } from '@/lib/dad-tools/savings-actions'
import { buttonVariants } from '@/components/ui/Button'
import { Field, fieldClass } from '@/components/ui/Field'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

function LoginForm() {
  const searchParams = useSearchParams()
  const rawNext = searchParams.get('next') ?? ''
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', data.user.id)
      .single()

    const username = profile?.username ?? email.split('@')[0]
    try {
      sessionStorage.setItem('just_signed_in', username)
    } catch {
      // sessionStorage can throw in PWA / private-mode contexts. Non-fatal.
    }

    // Migrate any anonymous Dad Tools data tied to the bd_anon_id cookie
    // into this user. Idempotent + cheap when no cookie/no rows. Covers the
    // case where the user registered earlier with email confirmation and is
    // now logging in for the first time (register-time claim was skipped).
    // Wrap in try/catch so a server-action hang or thrown error never
    // blocks the post-login redirect — the claim is best-effort.
    try {
      const claim = await claimAnonymousData()
      if (!claim.ok) {
        console.warn('claim-on-login returned not-ok:', claim.error)
      }
    } catch (err) {
      console.warn('claim-on-login threw:', err)
    }

    // Relay any pending savings-goal email invites to in-app notifications.
    try { await claimMyPendingInvites() } catch (err) { console.warn('invite claim (login) threw:', err) }

    // Hard navigation — forces a fresh server render with the new auth
    // cookie. router.push() is fragile on mobile and inside PWA standalone
    // mode (service worker + client router state can prevent the redirect
    // from settling). This is the conventional pattern for post-auth nav.
    window.location.assign(next)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* A raw label row + fieldClass, not <Field>: the "Forgot password?" link
          sits on the label's line, which Field's label can't hold. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-semibold text-prose">Password</label>
          {/* py + matching -my = a 44px hit area that doesn't change the row's height. */}
          <Link href="/forgot-password" className="inline-block py-3.5 -my-3.5 text-xs font-semibold text-accent-text hover:text-accent">
            Forgot password?
          </Link>
        </div>
        <input
          autoComplete="current-password"
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldClass()}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-md px-4 py-2.5">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className={buttonVariants({ className: 'w-full' })}
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <>
      <PageHeader
        size="compact"
        eyebrow={LABELS.auth.login.eyebrow}
        title={LABELS.auth.login.h1}
        deck="Sign in to your account"
        className="mb-6"
      />

      <Suspense fallback={<div className="h-48 animate-pulse bg-surface rounded-md" />}>
        <LoginForm />
      </Suspense>

      <p className="mt-6 text-center text-sm text-prose-faint">
        New here?{' '}
        <Link href="/register" className="inline-block py-3 -my-3 font-semibold text-accent-text hover:text-accent">
          Create an account
        </Link>
      </p>
    </>
  )
}
