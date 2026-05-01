import Link from 'next/link'
import { SOCIAL } from '@/lib/social'
import { EmailSignup } from '@/components/EmailSignup'

const FOOTER_LINKS = [
  { href: '/reviews',              label: 'Reviews' },
  { href: '/guides',               label: 'Guides' },
  { href: '/stuff',                label: 'Stuff' },
  { href: '/bench',                label: 'On the Bench' },
  { href: '/about',                label: 'About' },
  { href: '/how-we-test',          label: 'How We Test' },
  { href: '/affiliate-disclosure', label: 'Disclosure' },
  { href: '/editorial-standards',  label: 'Standards' },
  { href: '/privacy-policy',       label: 'Privacy' },
  { href: '/terms',                label: 'Terms' },
  { href: '/feed.xml',             label: 'RSS' },
]

const SOCIAL_ICONS = [
  {
    key: 'x',
    label: 'X (Twitter)',
    href: SOCIAL.x,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    key: 'instagram',
    label: 'Instagram',
    href: SOCIAL.instagram,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    key: 'youtube',
    label: 'YouTube',
    href: SOCIAL.youtube,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    href: SOCIAL.facebook,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    href: SOCIAL.tiktok,
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/60 bg-gray-900/30">
      {/* Newsletter band */}
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-8 text-center">
        <p className="text-gray-500 text-xs uppercase tracking-widest mb-2">Welcome to the crew.</p>
        <h3 className="text-2xl font-black mb-2">Get the good stuff in your inbox</h3>
        <p className="text-gray-400 text-sm mb-6">
          One email when there&apos;s actually something worth saying. No daily spam, no fluff.
        </p>
        <EmailSignup
          heading={null}
          description={null}
          buttonLabel="Sign me up"
          successMessage="You're in. Welcome to the crew."
          interests={['newsletter']}
        />
      </div>

      {/* Social */}
      <div className="max-w-6xl mx-auto px-6 pb-6 text-center border-b border-gray-800/40">
        <div className="flex items-center justify-center gap-5">
          {SOCIAL_ICONS.map(({ key, label, href, icon }) =>
            href ? (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-gray-500 hover:text-gray-100 transition-colors"
              >
                {icon}
              </a>
            ) : (
              <span
                key={key}
                aria-label={`${label} — coming soon`}
                title={`${label} — coming soon`}
                className="text-gray-700 cursor-not-allowed"
              >
                {icon}
              </span>
            )
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <Link href="/" className="font-black text-gray-400 tracking-tight hover:text-gray-200 transition-colors py-2 inline-block">
            BOSS DADDY LIFE
          </Link>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="py-2 inline-block hover:text-gray-300 transition-colors">
                {label}
              </Link>
            ))}
          </div>
          <span>© {new Date().getFullYear()} Boss Daddy LLC</span>
        </div>
      </div>
    </footer>
  )
}
