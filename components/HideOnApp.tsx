'use client'

import { usePathname } from 'next/navigation'
import { isAppRoute } from '@/lib/app-routes'

// Renders children everywhere EXCEPT the Toolbox routes (lib/app-routes.ts):
// the topics row is the Magazine's wayfinding and is noise between the masthead
// and the deck; the app has the dock, the launcher and the Tools tab. The
// immersive DM view sits under /account, so it is covered too.
export default function HideOnApp({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isAppRoute(pathname)) return null
  return <>{children}</>
}
