import Link from 'next/link'

const FOOTER_LINKS = [
  { href: '/reviews',              label: 'Reviews' },
  { href: '/articles',             label: 'Articles' },
  { href: '/shop',                 label: 'Shop' },
  { href: '/about',                label: 'About' },
  { href: '/affiliate-disclosure', label: 'Disclosure' },
]

export default function Footer() {
  return (
    <footer className="border-t border-gray-800/60 bg-gray-900/30">
      <div className="max-w-6xl mx-auto px-6 py-10">
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
