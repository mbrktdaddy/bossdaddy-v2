import Image from 'next/image'
import Link from 'next/link'
import { LabelBlock } from '@/components/ui/LabelBlock'
import { buttonVariants } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center">
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
      <div data-theme="dark" className="bg-chrome text-prose border-t-4 border-accent rounded-xl px-6 py-8 sm:px-10 max-w-md w-full">
        <LabelBlock tone="accent" className="mb-4">404</LabelBlock>
        <h1 className="text-4xl font-black uppercase text-prose mb-3">Page not found</h1>
        <p className="text-prose-faint text-sm mb-8 max-w-sm mx-auto">
          This page doesn&apos;t exist — or it may have moved. Head back and keep dadding like a boss.
        </p>
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <Link href="/" className={buttonVariants({ size: 'lg' })}>
            Go Home
          </Link>
          <Link href="/reviews" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Browse Reviews
          </Link>
        </div>
      </div>
    </main>
  )
}
