'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Catches errors in the root layout itself. The standard error.tsx can't
// catch those because the layout fails before its boundary mounts.
export default function GlobalError({
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
    <html>
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#0a0a0a', color: '#ffffff' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#f87171', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, marginBottom: '16px' }}>
            Something went wrong
          </p>
          <h1 style={{ fontSize: '36px', fontWeight: 900, marginBottom: '12px' }}>
            Unexpected error
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '14px', maxWidth: '400px', marginBottom: '32px' }}>
            We hit a snag at the root level. Try again or reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              backgroundColor: '#CC5500',
              color: '#ffffff',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Try Again
          </button>
        </main>
      </body>
    </html>
  )
}
