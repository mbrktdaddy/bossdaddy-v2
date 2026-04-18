import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/reviews',              label: 'Reviews' },
  { href: '/articles',             label: 'Articles' },
  { href: '/shop',                 label: 'Shop' },
  { href: '/about',                label: 'About' },
  { href: '/how-we-test',          label: 'How We Test' },
  { href: '/affiliate-disclosure', label: 'Disclosure' },
  { href: '/editorial-standards',  label: 'Standards' },
  { href: '/privacy-policy',       label: 'Privacy' },
  { href: '/terms',                label: 'Terms' },
]

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/60 bg-gray-900/30">
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-4 text-center border-b border-gray-800/40">
        <p className="text-gray-600 text-xs uppercase tracking-widest mb-1">Welcome to the crew.</p>
        <p className="text-gray-500 text-sm font-semibold">Now let&apos;s dad like a boss — together.</p>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <Link href="/" className="font-black text-gray-500 tracking-tight hover:text-gray-400 transition-colors">
            BOSS DADDY LIFE
          </Link>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {FOOTER_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className="hover:text-gray-400 transition-colors">
                {label}
              </Link>
            ))}
          </div>
          <span>© {new Date().getFullYear()} Boss Daddy Life</span>
        </div>
      </div>
    </footer>
  )
}

