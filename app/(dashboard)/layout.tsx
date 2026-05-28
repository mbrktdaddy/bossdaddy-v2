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
    <div
      data-theme="dark"
      className={`${geistMono.variable} min-h-screen bg-background text-prose md:flex`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <DashboardNav
        username={profile?.username ?? 'Boss'}
        isAdmin={isAdmin}
        role={profile?.role ?? 'member'}
        avatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
      />

      {/* pt-14 on mobile clears the fixed top bar; desktop uses normal flow */}
      <main id="main-content" className="flex-1 overflow-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
