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
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-red-500 text-xs uppercase tracking-widest font-semibold mb-4">Something went wrong</p>
      <h1 className="text-4xl font-black text-white mb-3">Unexpected error</h1>
      <p className="text-gray-400 text-sm mb-8 max-w-sm">
        We hit a snag. Try again or head back home — we&apos;re on it.
      </p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Try Again
        </button>
        <Link href="/" className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm">
          Go Home
        </Link>
      </div>
    </main>
  )
}
