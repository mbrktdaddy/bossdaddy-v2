import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account access restricted',
  robots: { index: false, follow: false },
}

export default function AccountBlockedPage() {
  return (
    <main className="max-w-xl mx-auto px-6 py-24 text-center">
      <p className="text-eyebrow text-xs uppercase tracking-widest font-semibold mb-4">
        Account access restricted
      </p>
      <h1 className="text-3xl sm:text-4xl font-black mb-4">Your account is on hold.</h1>
      <p className="text-[var(--bd-text-muted)] leading-relaxed mb-8">
        This account can&apos;t sign in right now. This usually means it has been
        suspended, banned, or scheduled for deletion. If you think this is a
        mistake, reach out and we&apos;ll take a look.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
        <a
          href="mailto:boss@bossdaddylife.com?subject=Account%20access%20question"
          className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors text-sm"
        >
          Contact Boss Daddy
        </a>
        <Link
          href="/"
          className="px-6 py-3 bg-surface-raised hover:bg-stone-100 border border-strong text-prose-muted font-semibold rounded-xl transition-colors text-sm"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
