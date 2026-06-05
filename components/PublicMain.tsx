'use client'

import { usePathname } from 'next/navigation'
import { isImmersiveRoute } from '@/lib/immersive-routes'

// <main> wrapper that drops the mobile bottom-nav clearance (pb-14) on immersive
// routes, where MobileBottomNav hides itself. Keeps the #main-content skip-link
// target. Children are server-rendered and passed straight through.
export default function PublicMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const immersive = isImmersiveRoute(pathname)
  return (
    <main
      id="main-content"
      className={`flex-1 w-full overflow-x-clip ${immersive ? '' : 'pb-14 md:pb-0'}`}
    >
      {children}
    </main>
  )
}
