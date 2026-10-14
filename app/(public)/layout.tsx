import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import CategoryBar from '@/components/CategoryBar'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import InstallPrompt from '@/components/InstallPrompt'
import AskBossFab from '@/components/AskBossFab'
import PublicMain from '@/components/PublicMain'
import HideOnImmersive from '@/components/HideOnImmersive'
import { isGiftSeason } from '@/lib/gift-occasions'
import { hasLiveSeasonalGifts } from '@/lib/collections/seasonal-gifts'

const WelcomeToast = dynamic(() => import('@/components/WelcomeToast'))

// No server-side auth here on purpose. Reading the session cookie in this shared
// layout forced the ENTIRE public surface to render dynamically (audit H3). The
// Header now resolves auth on the client (flash-free via the local session), so
// every public page can be statically prerendered / ISR.
//
// The ONE read this layout does make is cookie-free and cached (an anon client
// behind `unstable_cache`), so it keeps every page static/ISR — see the note on
// `hasLiveSeasonalGifts`.
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Gift season = the calendar window (1 Oct – 26 Dec, `isGiftSeason()`) AND a
  // live seasonal guide to send people to. Decided here on the server, once,
  // and handed to the client Header and the Footer as a prop so no two
  // surfaces (or the two sides of hydration) can disagree. The date half runs
  // first so the read is skipped nine months of the year.
  const giftSeason = isGiftSeason() && (await hasLiveSeasonalGifts())

  return (
    <div className="min-h-screen bg-background text-prose flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <Header giftSeason={giftSeason} />
      {/* Topics row (every width since Hard Goods) — scrolls away with the page
          while the masthead sticks. Since 2026-10-14 this row IS the topics
          nav; the masthead carries the places (Explore · Gear · Shop | Tools). */}
      <HideOnImmersive><CategoryBar /></HideOnImmersive>
      <PublicMain>{children}</PublicMain>
      <HideOnImmersive><Footer giftSeason={giftSeason} /></HideOnImmersive>
      <MobileBottomNav />
      <InstallPrompt />
      <AskBossFab />
      <WelcomeToast />
    </div>
  )
}
