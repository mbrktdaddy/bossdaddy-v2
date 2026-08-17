'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
      <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-black text-prose mb-2">This link isn&apos;t valid</h1>
          <p className="text-prose-muted mb-8 text-sm">
            Password reset links can only be used once, and they expire. Request a fresh one and
            we&apos;ll email you a new link.
          </p>
          <a
            href="/forgot-password"
            className="block w-full text-center py-2.5 px-4 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors"
          >
            Request a new reset link
          </a>
          <p className="text-prose-faint text-xs mt-4 text-center">
            Already know your password?{' '}
            <a href="/login" className="text-accent-text-soft hover:text-accent">Sign in</a>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-prose mb-2">Set new password</h1>
        <p className="text-prose-muted mb-8 text-sm">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-prose-muted mb-1">New password</label>
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

          <div>
            <label htmlFor="confirm" className="block text-sm text-prose-muted mb-1">Confirm password</label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-prose placeholder:text-prose-faint focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="Same password again"
            />
          </div>

          {error && (
            <div className="text-red-700 text-sm bg-red-50 border border-red-300 rounded-lg px-4 py-2">
              <p>{error}</p>
              {needsNewLink && (
                <a href="/forgot-password" className="text-accent-text-soft hover:text-accent text-xs mt-1 inline-block">
                  Request a new reset link →
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || authed === null}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </main>
  )
}
