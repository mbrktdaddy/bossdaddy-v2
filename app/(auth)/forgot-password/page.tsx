'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-callback`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-accent-tint border border-accent-border/50 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-prose mb-2">Check your inbox</h1>
          <p className="text-prose-muted text-sm mb-6">
            We sent a reset link to <span className="text-accent-text-soft">{email}</span>. Click it to set a new password.
          </p>
          <p className="text-prose-faint text-xs">
            Didn&apos;t get it? Check your spam folder or{' '}
            <button onClick={() => setSent(false)} className="text-accent-text-soft hover:text-accent">
              try again
            </button>
            .
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-prose mb-2">Reset your password</h1>
        <p className="text-prose-muted mb-8 text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-prose-muted mb-1">Email</label>
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

          {error && (
            <p className="text-red-300 text-sm bg-red-950/40 border border-red-700/40 rounded-lg px-4 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-prose-faint">
          Remember it?{' '}
          <Link href="/login" className="text-accent-text-soft hover:text-accent">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
