// TEMPORARY — Sentry prod verification. Delete after confirming capture.
// Placed outside the (public)/(tools) route groups so the OG-coverage guard
// (scripts/check-og-coverage.mjs) doesn't require a social card for it.
export const dynamic = 'force-dynamic'

export default function SentryTestPage() {
  throw new Error('Sentry prod test — safe to ignore (delete /sentry-test route)')
}
