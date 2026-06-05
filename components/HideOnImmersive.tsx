'use client'

import { usePathname } from 'next/navigation'
import { isImmersiveRoute } from '@/lib/immersive-routes'

// Renders children everywhere EXCEPT immersive routes (e.g. the DM conversation
// view), where chrome like the footer would add page-scroll height beneath a
// full-viewport app screen. Keeps that decision in one shared place.
export default function HideOnImmersive({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (isImmersiveRoute(pathname)) return null
  return <>{children}</>
}
