'use client'

import { usePathname } from 'next/navigation'

/**
 * Build a /login href that returns the user to the page they're on after
 * sign-in — instead of the home page. Use for any "Sign in" affordance shown
 * on a content page. Captures the current pathname (the login page reads the
 * `next` param and redirects there post-auth).
 */
export function useLoginHref(): string {
  const pathname = usePathname()
  return `/login?next=${encodeURIComponent(pathname || '/')}`
}
