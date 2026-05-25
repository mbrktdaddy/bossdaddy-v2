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
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="py-24 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-red-700 text-xs uppercase tracking-widest font-semibold mb-3">Something went wrong</p>
      <p className="text-prose-muted text-sm mb-8 max-w-sm">
        This page hit an error. Try refreshing or head back.
      </p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Try Again
        </button>
        <Link href="/gear" className="px-5 py-2.5 bg-surface-raised hover:bg-surface border border-strong text-prose-muted font-semibold rounded-xl transition-colors text-sm">
          All Gear
        </Link>
      </div>
    </div>
  )
}
