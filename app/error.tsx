'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center px-6 text-center">
      <p className="text-red-500 text-xs uppercase tracking-widest font-semibold mb-4">Something went wrong</p>
      <h1 className="text-4xl font-black text-white mb-3">Unexpected error</h1>
      <p className="text-prose-muted text-sm mb-8 max-w-sm">
        We hit a snag. Try again or head back home — we&apos;re on it.
      </p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Try Again
        </button>
        <Link href="/" className="px-6 py-3 bg-surface-raised hover:bg-gray-700 border border-strong text-gray-300 font-semibold rounded-xl transition-colors text-sm">
          Go Home
        </Link>
      </div>
    </main>
  )
}
