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
        className="fixed top-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
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
      {children}
    </>
  )
}
