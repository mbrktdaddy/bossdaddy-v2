// Next.js instrumentation hook — loads the right Sentry runtime config
// based on whether the code is running in Node.js or Edge runtime.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    // Money-path guard: the Associates tag is the entire revenue mechanism.
    // If it's unset in production, every /go/* redirect silently drops the tag
    // (appendAmazonTag returns the URL unchanged) — 100% commission loss with
    // no other signal until manual Amazon reconciliation. Fail loudly at boot.
    if (process.env.VERCEL_ENV === 'production' && !process.env.AMAZON_ASSOCIATE_TAG) {
      Sentry.captureMessage(
        'AMAZON_ASSOCIATE_TAG is unset in production — affiliate links are untagged (zero commission)',
        'error',
      )
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
