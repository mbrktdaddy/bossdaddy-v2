'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { EmptyState } from './EmptyState'
import { buttonVariants } from './Button'

// The one route error screen (continuity plan P13) — every `error.tsx` renders
// this with its own sentence and its own parent. Nine copies had drifted into a
// raw `text-red-700` eyebrow, a `secondary` button that vanished on white, and
// "Home" as the only way out of a page three levels deep.
//
//   export default function Error(props: RouteErrorProps) {
//     return <RouteError {...props} body="This review hit an error." back={{ href: '/reviews', label: 'Reviews' }} />
//   }
//
// No red: an error page isn't a warning label, and the danger tokens are for
// form errors next to the field that caused them. `role="alert"` so a screen
// reader hears that the page failed, not just a pair of buttons.
// app/global-error.tsx can't use this (it replaces the root layout — no CSS,
// no fonts); it mirrors the look in inline styles.

export interface RouteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export function RouteError({
  error, reset, title = 'Something went wrong', body = 'This page hit an error. Try again, or head back.', back = { href: '/', label: 'Home' },
}: RouteErrorProps & {
  title?: string
  body?: string
  /** The page's logical parent (up, not back — lib/labels.ts rule 2). */
  back?: { href: string; label: string }
}) {
  useEffect(() => { Sentry.captureException(error) }, [error])
  return (
    <div role="alert" className="max-w-xl mx-auto px-6 py-16 sm:py-24">
      <EmptyState
        size="md"
        title={title}
        body={body}
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={reset} className={buttonVariants()}>Try again</button>
            <Link href={back.href} className={buttonVariants({ variant: 'outline' })}>{back.label}</Link>
          </div>
        }
      />
    </div>
  )
}
