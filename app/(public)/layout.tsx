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
  if (user) {
    const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single()
    username = data?.username ?? user.email?.split('@')[0] ?? 'Account'
  }

  return (
    <div className="min-h-screen bg-background text-prose flex flex-col">
      <Header username={username} />
      <main className="flex-1 w-full overflow-x-clip pb-14 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <WelcomeToast />
    </div>
  )
}
