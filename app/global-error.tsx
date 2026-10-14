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

  // Inline styles only: this replaces the root layout, so globals.css and the
  // fonts never load. It mirrors the light canvas (white page, #18181b ink, the
  // 4px orange masthead rule, the black uppercase button) by hand — the old
  // dark page with a red eyebrow was the last screen still on the dark canvas.
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', background: '#ffffff', color: '#18181b' }}>
        <div style={{ height: '64px', background: '#09090b', borderBottom: '4px solid #CC5500' }} />
        <main style={{ minHeight: 'calc(100vh - 68px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.05, margin: '0 0 12px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#52525b', fontSize: '16px', lineHeight: 1.6, maxWidth: '400px', margin: '0 0 32px' }}>
            We hit a snag loading the site. Try again, or reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              minHeight: '48px',
              padding: '0 28px',
              backgroundColor: '#09090b',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '14px',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
