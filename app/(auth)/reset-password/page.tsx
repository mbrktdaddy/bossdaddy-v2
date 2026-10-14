'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buttonVariants } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsNewLink, setNeedsNewLink] = useState(false)

  // null = still checking, true = signed in, false = arrived with no session.
  //
  // updateUser() can only change the password of an authenticated user, and the
  // session is established by /reset-callback exchanging the code — NOT by this
  // page. Anyone who reaches this URL without going through that exchange gets a
  // form that cannot possibly work. Previously it rendered anyway and then
  // reported "Your reset link has expired", which was wrong twice over: nothing
  // had expired, and the real problem (no session) was invisible. That's exactly
  // how a misrouted signup confirmation looked like a broken reset link.
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const supabase = createClient()
      // getUser(), never getSession() — project rule; getSession() trusts
      // unverified local storage.
      const { data } = await supabase.auth.getUser()
      if (!cancelled) setAuthed(Boolean(data.user))
    })()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    setError(null)
    setNeedsNewLink(false)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      if (error.message.toLowerCase().includes('session')) {
        setError('Your session has ended, so there is nothing to update from this page.')
        setNeedsNewLink(true)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  // Arrived with no session — don't offer a form that can't work.
  if (authed === false) {
    return (
      <>
        <PageHeader
          size="compact"
          eyebrow={LABELS.auth.recoveryEyebrow}
          title={LABELS.auth.reset.invalidH1}
          deck="Password reset links can only be used once, and they expire. Request a fresh one and we’ll email you a new link."
          className="mb-6"
        />
        <a
          href="/forgot-password"
          className={buttonVariants({ className: 'w-full' })}
        >
          Request a new reset link
        </a>
        <p className="mt-4 text-center text-sm text-prose-faint">
          Already know your password?{' '}
          <a href="/login" className="inline-block py-3 -my-3 font-semibold text-accent-text hover:text-accent">Sign in</a>
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader
        size="compact"
        eyebrow={LABELS.auth.recoveryEyebrow}
        title={LABELS.auth.reset.h1}
        deck="Choose a strong password for your account."
        className="mb-6"
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="New password"
          autoComplete="new-password"
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8+ characters"
        />

        <Field
          label="Confirm password"
          autoComplete="new-password"
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Same password again"
        />

        {error && (
          <div role="alert" className="text-sm font-medium text-danger-ink bg-danger-bg border border-danger-line rounded-md px-4 py-2.5">
            <p>{error}</p>
            {needsNewLink && (
              <a href="/forgot-password" className="inline-block py-3 -my-3 font-semibold underline underline-offset-2 hover:no-underline">
                Request a new reset link →
              </a>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || authed === null}
          className={buttonVariants({ className: 'w-full' })}
        >
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </>
  )
}
