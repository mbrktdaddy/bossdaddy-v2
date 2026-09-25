'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { buttonVariants } from '@/components/ui/Button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div className="py-24 flex flex-col items-center justify-center px-6 text-center">
      <p className="text-red-700 text-xs uppercase tracking-widest font-semibold mb-3">Something went wrong</p>
      <p className="text-prose-muted text-sm mb-8 max-w-sm">This profile page hit an error. Try refreshing or head back.</p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button onClick={reset} className={buttonVariants()}>Try Again</button>
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>Home</Link>
      </div>
    </div>
  )
}
