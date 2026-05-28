// Tools route group — minimal chrome, no editorial nav. Same brand anchor
// (wordmark, orange `#CC5500`, voice) and the same Footer as the rest of
// the site. See docs/dad-tools-plan.md §5 for the architecture rationale.

import Link from 'next/link'
import Image from 'next/image'
import Footer from '@/components/Footer'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export default async function ToolsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const isAuthed = !!user

  return (
    <div className="min-h-screen bg-background text-prose flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-surface focus:text-prose focus:px-4 focus:py-2 focus:rounded-lg focus:border focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>

      <header className="border-b border-faint bg-surface">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/images/bd-logo-icon.png"
              alt="Boss Daddy"
              width={36}
              height={36}
              priority
              className="h-8 w-8 object-contain shrink-0"
            />
            <span className="font-black text-lg sm:text-xl tracking-tight shrink-0">
              <span className="text-accent">BOSS</span>
              <span className="text-prose"> DADDY</span>
            </span>
            <span className="text-[10px] sm:text-xs font-medium uppercase tracking-widest text-accent-text border border-accent/30 rounded-full px-2 py-0.5 shrink-0">
              Tools · Beta
            </span>
          </Link>
          <nav className="flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="hidden sm:inline text-sm text-prose-faint hover:text-prose transition-colors"
            >
              ← Boss Daddy
            </Link>
            {isAuthed ? (
              <Link
                href="/dashboard"
                className="text-sm font-medium text-accent hover:underline"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-accent hover:underline"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1 w-full">
        {children}
      </main>

      <Footer />
    </div>
  )
}
