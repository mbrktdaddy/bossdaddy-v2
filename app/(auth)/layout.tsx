import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Link
        href="/"
        aria-label="Boss Daddy — Home"
        className="fixed top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 min-h-[44px]"
      >
        <Image
          src="/images/bd-logo-icon.png"
          alt=""
          width={40}
          height={40}
          priority
          className="h-10 w-10 object-contain"
        />
        <span className="font-black tracking-tight text-sm">
          <span className="text-accent-text">BOSS</span>
          <span className="text-prose"> DADDY</span>
        </span>
      </Link>
      {/* The one shell for all four auth pages (each used to repeat it, twice for
          the pages with a second state). One `max-w-sm` column is what the
          `PageHeader size="compact"` lockup inherits its width from. `py-24`
          keeps the form clear of the fixed logo above when the page is taller
          than the viewport — the lockup made it taller than the old bare H1. */}
      <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4 py-24">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </>
  )
}
