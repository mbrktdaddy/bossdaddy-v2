'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div className="py-24 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-red-400 text-xs uppercase tracking-widest font-semibold mb-3">Workspace error</p>
      <p className="text-prose-muted text-sm mb-2 max-w-sm">Something went wrong loading this review. Your draft is safe — try reloading.</p>
      {error.digest && <p className="text-prose-faint text-xs font-mono mb-6">ref: {error.digest}</p>}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button onClick={reset} className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors text-sm">Reload workspace</button>
        <Link href="/dashboard" className="px-5 py-2.5 bg-surface-raised hover:bg-zinc-700 border border-strong text-prose-muted font-semibold rounded-xl transition-colors text-sm">Dashboard</Link>
      </div>
    </div>
  )
}
