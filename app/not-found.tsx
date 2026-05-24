import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" aria-label="Boss Daddy — Home" className="mb-6">
        <Image
          src="/images/bd-logo-badge.png"
          alt=""
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain"
        />
      </Link>
      <p className="text-eyebrow text-xs uppercase tracking-widest font-semibold mb-4">404</p>
      <h1 className="text-4xl font-black text-prose mb-3">Page not found</h1>
      <p className="text-prose-muted text-sm mb-8 max-w-sm">
        This page doesn&apos;t exist — or it may have moved. Head back and keep dadding like a boss.
      </p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <Link href="/" className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors text-sm">
          Go Home
        </Link>
        <Link href="/reviews" className="px-6 py-3 bg-surface-raised hover:bg-zinc-700 border border-strong text-prose-muted font-semibold rounded-xl transition-colors text-sm">
          Browse Reviews
        </Link>
      </div>
    </main>
  )
}
