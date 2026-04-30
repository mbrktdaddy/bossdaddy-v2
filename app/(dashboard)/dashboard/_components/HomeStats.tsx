import Link from 'next/link'

interface Counts {
  articles:       { total: number; live: number; pending: number; draft: number }
  reviews:        { total: number; live: number; pending: number; draft: number }
  comments:       { pending: number }
  media:          { total: number }
  flagged:        number // pending items with moderation_score >= 0.7
}

export function HomeStats({ counts }: { counts: Counts }) {
  const cards = [
    { label: 'Live Guides',      value: counts.articles.live,    href: '/dashboard/articles?filter=live',    color: 'text-green-400' },
    { label: 'Live Reviews',     value: counts.reviews.live,     href: '/dashboard/reviews?filter=live',     color: 'text-green-400' },
    { label: 'Guide Drafts',     value: counts.articles.draft,   href: '/dashboard/articles?filter=drafts',  color: 'text-gray-300' },
    { label: 'Review Drafts',    value: counts.reviews.draft,    href: '/dashboard/reviews?filter=drafts',   color: 'text-gray-300' },
    { label: 'Pending Review',   value: counts.articles.pending + counts.reviews.pending, href: '/dashboard/articles?filter=pending', color: 'text-yellow-400' },
    { label: 'Flagged Content',  value: counts.flagged,          href: '/dashboard/articles?filter=pending', color: 'text-red-400' },
    { label: 'Pending Comments', value: counts.comments.pending, href: '/dashboard/comments',                color: 'text-blue-400' },
    { label: 'Media Assets',     value: counts.media.total,      href: '/dashboard/images',                  color: 'text-white' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="block bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 transition-colors"
        >
          <p className={`text-xl sm:text-2xl font-black ${c.color}`}>{c.value}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{c.label}</p>
        </Link>
      ))}
    </div>
  )
}
