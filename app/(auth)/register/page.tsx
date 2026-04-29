'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  // Only allow relative paths to prevent open-redirect
  const redirectTo = nextParam && nextParam.startsWith('/') ? nextParam : '/'

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

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-white mb-2">Join the Crew</h1>
        <p className="text-gray-400 mb-8 text-sm">Create your Boss Daddy account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm text-gray-300 mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="bossdad42"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="8+ characters"
            />
          </div>

          {error && (
            <div className="text-sm bg-red-950/50 border border-red-800 rounded-lg px-4 py-3">
              {error === 'already_exists' ? (
                <p className="text-red-400">
                  An account with that email already exists.{' '}
                  <Link href={`/login?next=${encodeURIComponent(redirectTo)}`} className="text-orange-400 hover:text-orange-300 font-semibold">
                    Sign in instead →
                  </Link>
                </p>
              ) : (
                <p className="text-red-400">{error}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-400 hover:text-orange-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
