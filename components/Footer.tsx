import Image from 'next/image'
import Link from 'next/link'
import { SOCIAL } from '@/lib/social'
import { LABELS } from '@/lib/labels'

interface BrowseLink { href: string; label: string; hint?: string }

const BROWSE: BrowseLink[] = [
  { href: '/reviews',              label: LABELS.reviews.plural },
  { href: '/guides',               label: LABELS.guides.plural },
  { href: '/gear',                 label: LABELS.gear.short },
  { href: '/vault',                label: LABELS.vault.full,  hint: LABELS.vault.tagline },
  { href: '/comparisons',          label: LABELS.comparisons.short },
  { href: '/picks',                label: LABELS.picks.short },
  { href: '/stacks',               label: LABELS.stacks.short },
  { href: '/gifts',                label: LABELS.gifts.short },
  { href: '/bench',                label: LABELS.bench.full,  hint: LABELS.bench.tagline },
  { href: '/tools',                label: LABELS.tools.short, hint: LABELS.tools.hub.metaDescription },
]

const TRUST: BrowseLink[] = [
  { href: '/about',                label: 'About' },
  { href: '/how-we-test',          label: 'How We Test' },
  { href: '/affiliate-disclosure', label: 'Disclosure' },
  { href: '/editorial-standards',  label: 'Standards' },
  { href: '/privacy-policy',       label: 'Privacy' },
  { href: '/terms',                label: 'Terms' },
  { href: '/feed.xml',             label: 'RSS' },
]

interface SocialDef {
  key: string
  label: string
  href: string
  path: string
}

const SOCIAL_ICONS: SocialDef[] = [
  {
    key: 'x', label: 'X (Twitter)', href: SOCIAL.x,
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    key: 'instagram', label: 'Instagram', href: SOCIAL.instagram,
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  },
  {
    key: 'youtube', label: 'YouTube', href: SOCIAL.youtube,
    path: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    key: 'facebook', label: 'Facebook', href: SOCIAL.facebook,
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    key: 'tiktok', label: 'TikTok', href: SOCIAL.tiktok,
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
]

function SocialIcon({ icon }: { icon: SocialDef }) {
  const inner = (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={icon.path} />
    </svg>
  )
  if (icon.href) {
    return (
      <a
        href={icon.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={icon.label}
        className="inline-flex items-center justify-center w-9 h-9 text-prose-muted hover:text-prose transition-colors"
      >
        {inner}
      </a>
    )
  }
  return (
    <span
      role="img"
      aria-label={`${icon.label} — coming soon`}
      title={`${icon.label} — coming soon`}
      className="inline-flex items-center justify-center w-9 h-9 text-zinc-700 cursor-not-allowed"
    >
      {inner}
    </span>
  )
}

export default function Footer() {
  const year = new Date().getUTCFullYear()

  return (
    <footer className="bg-drama border-t-[3px] border-accent text-prose-muted">
      <div className="max-w-6xl mx-auto px-6 py-14">

        {/* Top: 3-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr] gap-10 md:gap-12">

          {/* Brand */}
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4">
              <Image
                src="/images/bd-logo-icon.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
              />
              <span className="text-lg font-black tracking-tight text-white">
                <span className="text-accent">BOSS</span>
                <span> DADDY LIFE</span>
              </span>
            </Link>
            <p className="text-sm text-prose-muted leading-relaxed mb-5 max-w-sm">
              Real-world reviews. No PR samples. No paid placements. Just an honest verdict from a dad who bought the thing and used it.
            </p>
            <Link
              href="/install"
              className="inline-flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl border border-strong hover:border-accent text-sm font-semibold text-zinc-200 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" />
              </svg>
              {LABELS.app.short}
            </Link>
            <div className="flex items-center gap-1 -ml-1.5">
              {SOCIAL_ICONS.map((i) => <SocialIcon key={i.key} icon={i} />)}
            </div>
          </div>

          {/* Browse */}
          <div>
            <p className="text-[11px] font-extrabold text-prose-faint uppercase tracking-[0.18em] mb-4">
              Browse
            </p>
            <ul className="flex flex-col gap-3">
              {BROWSE.map(({ href, label, hint }) => (
                <li key={href}>
                  <Link href={href} title={hint} className="text-sm text-prose-muted hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Trust & Legal */}
          <div>
            <p className="text-[11px] font-extrabold text-prose-faint uppercase tracking-[0.18em] mb-4">
              Trust &amp; Legal
            </p>
            <ul className="flex flex-col gap-3">
              {TRUST.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-prose-muted hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom: copyright */}
        <div className="mt-12 pt-6 border-t border-soft flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-prose-faint">
            © {year} Boss Daddy LLC. All rights reserved.
          </p>
          <p className="text-[11px] text-zinc-600 tracking-wide">
            Built by a dad. For dads.
          </p>
        </div>
      </div>
    </footer>
  )
}
