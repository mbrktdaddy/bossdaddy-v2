// Sentry client init.
//
// Session Replay was previously enabled via replaysOnErrorSampleRate: 1.0,
// but Replay's DOM mutation observer is known to clash with React 19
// hydration. We disabled Sentry entirely on 2026-05-12 (commit b6ffe1c) as
// a diagnostic; confirmed it wasn't Replay causing the workspace crash, so
// re-enabling error tracking WITHOUT Replay. Error capture is still useful
// for finding the actual cause of remaining issues.

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 10% of traces sampled. Plenty for an early-stage site.
    tracesSampleRate: 0.1,

    // Session Replay intentionally off — see header comment.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Ignore noisy/expected errors that aren't actionable
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Network request failed',
      // Browser extensions / 3rd party noise
      /chrome-extension:/,
      /moz-extension:/,
    ],

    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
  })
}
