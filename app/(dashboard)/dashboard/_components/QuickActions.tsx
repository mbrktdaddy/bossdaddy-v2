import Link from 'next/link'

const ACTIONS = [
  {
    href: '/dashboard/guides/new',
    label: 'New Guide',
    description: 'AI-first creation wizard',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    accent: 'text-orange-400 bg-orange-950/30 border-orange-900/40',
  },
  {
    href: '/dashboard/reviews/new',
    label: 'New Review',
    description: 'Product review with pros/cons',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    accent: 'text-orange-400 bg-orange-950/30 border-orange-900/40',
  },
  {
    href: '/dashboard/images/generate',
    label: 'Generate Image',
    description: 'Standalone DALL·E studio',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    accent: 'text-blue-400 bg-blue-950/30 border-blue-900/40',
  },
  {
    href: '/dashboard/images',
    label: 'Image Library',
    description: 'Browse and manage assets',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
      </svg>
    ),
    accent: 'text-purple-400 bg-purple-950/30 border-purple-900/40',
  },
  {
    href: '/dashboard/admin/products/new',
    label: 'New Product',
    description: 'Add a product for affiliate links',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    accent: 'text-green-400 bg-green-950/30 border-green-900/40',
  },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="group bg-gray-900 border border-gray-800 hover:border-orange-600/40 rounded-2xl p-5 transition-colors"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 border ${a.accent}`}>
            {a.icon}
          </div>
          <p className="text-sm font-semibold text-white group-hover:text-orange-400 transition-colors">{a.label}</p>
          <p className="text-xs text-gray-500 mt-1">{a.description}</p>
        </Link>
      ))}
    </div>
  )
}
