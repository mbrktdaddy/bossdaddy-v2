'use client'

import Link from 'next/link'
import { useLoginHref } from '@/lib/use-login-href'

/**
 * "Sign in" link that returns the user to the current page after auth. Lets
 * server-rendered pages/layouts get the return-to-current-page behavior
 * without calling the hook themselves.
 */
export function LoginLink({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const href = useLoginHref()
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}
