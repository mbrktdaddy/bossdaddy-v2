// Sentry config for the Node.js server runtime (API routes, RSCs, etc.)
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.VERCEL_ENV ?? 'development',
    // AI SDK spans (model, tokens, latency, keyed by the `surface:` tag as
    // functionId). Calls opt in via experimental_telemetry in lib/ai/client.ts.
    // Inputs/outputs are never recorded: drafts carry the author's family facts
    // and members' Boss conversations. The complete per-call record lives in
    // the `generations` table (mig 164); Sentry is for traces and failures.
    integrations: [Sentry.vercelAIIntegration({ recordInputs: false, recordOutputs: false })],
  })
}
