// DIAGNOSTIC: Sentry client init disabled to isolate a workspace hydration
// crash that survived a code-identical revert to a known-working state.
// If the workspace loads with Sentry off, Sentry's instrumentation (likely
// Session Replay's DOM mutation observer) is conflicting with React 19
// hydration. Re-enable in a controlled way once confirmed.
//
// Original config preserved below for easy restore.
//
// import * as Sentry from '@sentry/nextjs'
// const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN
// if (SENTRY_DSN) {
//   Sentry.init({
//     dsn: SENTRY_DSN,
//     tracesSampleRate: 0.1,
//     replaysSessionSampleRate: 0,
//     replaysOnErrorSampleRate: 1.0,
//     ignoreErrors: [
//       'ResizeObserver loop limit exceeded',
//       'ResizeObserver loop completed with undelivered notifications',
//       'Non-Error promise rejection captured',
//       'Network request failed',
//       /chrome-extension:/,
//       /moz-extension:/,
//     ],
//     environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
//   })
// }
export {}
