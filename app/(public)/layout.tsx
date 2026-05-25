import dynamic from 'next/dynamic'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MobileBottomNav from '@/components/MobileBottomNav'
import { createClient, getUserSafe } from '@/lib/supabase/server'

const WelcomeToast = dynamic(() => import('@/components/WelcomeToast'))

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  let username: string | null = null
  let role: string | null = null
  if (user) {
    const { data } = await supabase.from('profiles').select('username, role').eq('id', user.id).single()
    username = data?.username ?? user.email?.split('@')[0] ?? 'Account'
    role = data?.role ?? 'member'
  }

  return (
    <div className="min-h-screen bg-background text-prose flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <Header username={username} role={role} />
      <main id="main-content" className="flex-1 w-full overflow-x-clip pb-14 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <WelcomeToast />
    </div>
  )
}
