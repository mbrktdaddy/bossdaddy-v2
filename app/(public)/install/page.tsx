import Image from 'next/image'
import type { Metadata } from 'next'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import InstallCta from './_components/InstallCta'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: `${LABELS.app.full} — Boss Daddy`,
    description: LABELS.app.tagline,
    path: '/install',
    siteUrl,
    type: 'site',
    ogType: 'website',
  })
}

const PERKS: { title: string; body: string; icon: React.ReactNode }[] = [
  {
    title: 'One tap back in',
    body: 'A home-screen icon that lives in your app switcher — no typing the URL, no digging through browser tabs.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11l2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6" />,
  },
  {
    title: 'Fast and lightweight',
    body: 'It runs in its own window, loads quick, and takes up almost no space. No bloated download, no app store account.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  {
    title: 'Everything that matters',
    body: 'Honest reviews, the gear list, guides, and the dad tools — all the way you already use them, right where you left off.',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4" />,
  },
]

export default function InstallPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14 md:py-20">
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-20 h-20 rounded-2xl bg-surface-raised flex items-center justify-center mb-6 shadow-xl shadow-black/10">
          <Image
            src="/images/bd-logo-icon.png"
            alt="Boss Daddy"
            width={56}
            height={56}
            className="w-14 h-14 object-contain"
          />
        </div>
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Boss Daddy App</p>
        <h1 className="text-3xl md:text-4xl font-black text-prose leading-[1.1] tracking-tight mb-4">
          Keep Boss Daddy one tap away.
        </h1>
        <p className="text-base md:text-lg text-prose-muted leading-[1.7] max-w-xl">
          Add Boss Daddy to your home screen and it works like an app — fast, full-screen, and always
          a tap away. No app store, no bloat, no sign-up wall. Just the reviews, gear, and tools you
          came for, right where you keep everything else.
        </p>
      </div>

      {/* The action — the robust anchor that adapts to the device. */}
      <InstallCta />

      {/* Why bother */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {PERKS.map((perk) => (
          <div key={perk.title}>
            <div className="w-10 h-10 rounded-xl bg-surface border border-soft flex items-center justify-center text-accent mb-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                {perk.icon}
              </svg>
            </div>
            <h2 className="text-sm font-black text-prose leading-tight mb-1.5">{perk.title}</h2>
            <p className="text-sm text-prose-faint leading-snug">{perk.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
