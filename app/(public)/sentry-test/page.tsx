// TEMPORARY — Sentry prod verification. Delete after confirming capture.
export const dynamic = 'force-dynamic'

export default function SentryTestPage() {
  throw new Error('Sentry prod test — safe to ignore (delete /sentry-test route)')
}
