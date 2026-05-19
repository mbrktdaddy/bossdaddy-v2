'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      if (error.message.includes('session')) {
        setError('Your reset link has expired. Please request a new one.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-black text-white mb-2">Set new password</h1>
        <p className="text-prose-muted mb-8 text-sm">Choose a strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-gray-300 mb-1">New password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="8+ characters"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm text-gray-300 mb-1">Confirm password</label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-surface border border-strong text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-hover"
              placeholder="Same password again"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-2">
              <p>{error}</p>
              {error.includes('expired') && (
                <a href="/forgot-password" className="text-accent-text-soft hover:text-orange-300 text-xs mt-1 inline-block">
                  Request a new reset link →
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </main>
  )
}
