// This file configures the initialization of Sentry on the browser.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Adjust as traffic grows. 0.1 = 10% sampling.
    // For an early-stage site this is plenty.
    tracesSampleRate: 0.1,

    // Replay sampling (records user sessions for debugging).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

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
