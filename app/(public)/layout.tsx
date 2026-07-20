import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import AskBossFab from '@/components/AskBossFab'
import PublicMain from '@/components/PublicMain'
import HideOnImmersive from '@/components/HideOnImmersive'

const WelcomeToast = dynamic(() => import('@/components/WelcomeToast'))

// No server-side auth here on purpose. Reading the session cookie in this shared
// layout forced the ENTIRE public surface to render dynamically (audit H3). The
// Header now resolves auth on the client (flash-free via the local session), so
// every public page can be statically prerendered / ISR.
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-prose flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <Header />
      <PublicMain>{children}</PublicMain>
      <HideOnImmersive><Footer /></HideOnImmersive>
      <MobileBottomNav />
      <AskBossFab />
      <WelcomeToast />
    </div>
  )
}
