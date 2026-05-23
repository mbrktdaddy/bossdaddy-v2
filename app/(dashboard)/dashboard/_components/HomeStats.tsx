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
    { label: 'Live Guides',      value: counts.articles.live,    href: '/dashboard/guides?filter=live',      color: 'text-forest' },
    { label: 'Live Reviews',     value: counts.reviews.live,     href: '/dashboard/reviews?filter=live',     color: 'text-forest' },
    { label: 'Guide Drafts',     value: counts.articles.draft,   href: '/dashboard/guides?filter=drafts',    color: 'text-prose' },
    { label: 'Review Drafts',    value: counts.reviews.draft,    href: '/dashboard/reviews?filter=drafts',   color: 'text-prose' },
    { label: 'Pending Review',   value: counts.articles.pending + counts.reviews.pending, href: '/dashboard/guides?filter=pending', color: 'text-amber-600' },
    { label: 'Flagged Content',  value: counts.flagged,          href: '/dashboard/guides?filter=pending', color: 'text-red-600' },
    { label: 'Pending Comments', value: counts.comments.pending, href: '/dashboard/comments',                color: 'text-blue-700' },
    { label: 'Media Assets',     value: counts.media.total,      href: '/dashboard/images',                  color: 'text-prose' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          className="block bg-surface border border-soft hover:border-strong rounded-2xl px-4 py-3 sm:px-5 sm:py-4 transition-colors"
        >
          <p className={`text-xl sm:text-2xl font-black ${c.color}`}>{c.value}</p>
          <p className="text-xs text-prose-faint mt-1 uppercase tracking-wide">{c.label}</p>
        </Link>
      ))}
    </div>
  )
}
