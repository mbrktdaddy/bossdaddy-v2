import Image from 'next/image'
import Link from 'next/link'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface-sunken flex flex-col items-center justify-center px-6 text-center">
      <Link href="/" aria-label="Boss Daddy — Home" className="mb-6">
        <Image
          src="/images/bd-logo-icon.png"
          alt=""
          width={64}
          height={64}
          priority
          className="h-16 w-16 object-contain"
        />
      </Link>
      <Eyebrow className="mb-4">404</Eyebrow>
      <h1 className="text-4xl font-black text-prose mb-3">Page not found</h1>
      <p className="text-prose-muted text-sm mb-8 max-w-sm">
        This page doesn&apos;t exist — or it may have moved. Head back and keep dadding like a boss.
      </p>
      <div className="flex items-center gap-4 flex-wrap justify-center">
        <Link href="/" className={buttonVariants({ size: 'lg' })}>
          Go Home
        </Link>
        <Link href="/reviews" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
          Browse Reviews
        </Link>
      </div>
    </main>
  )
}
