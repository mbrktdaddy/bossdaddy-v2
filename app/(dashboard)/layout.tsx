import { Geist_Mono } from 'next/font/google'
import { requireUser, getCurrentProfile } from '@/lib/auth-cache'
import DashboardNav from '@/components/DashboardNav'

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()
  const profile = await getCurrentProfile()

  const isAdmin = profile?.role === 'admin'

  return (
    <div className={`${geistMono.variable} min-h-screen bg-gray-950 text-white md:flex`}>
      <DashboardNav username={profile?.username ?? 'Boss'} isAdmin={isAdmin} role={profile?.role ?? 'member'} />

      {/* pt-14 on mobile clears the fixed top bar; desktop uses normal flow */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
