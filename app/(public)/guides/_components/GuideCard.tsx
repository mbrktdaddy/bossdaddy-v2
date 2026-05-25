import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import type { GuideRow } from '../actions'

export default function GuideCard({ guide: a, priority = false }: { guide: GuideRow; priority?: boolean }) {
  const cat = getCategoryBySlug(a.category)
  return (
    <Link
      href={`/guides/${a.slug}`}
      className="group flex flex-col bg-surface rounded-xl overflow-hidden border border-soft shadow-lg shadow-black/5 hover:border-copper hover:shadow-xl hover:shadow-black/50 hover:-translate-y-1 transition-all duration-200"
    >
      {a.image_url ? (
        <div className="relative w-full h-44 bg-surface-raised shrink-0 overflow-hidden">
          <Image
            src={a.image_url}
            alt={a.title}
            fill
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
          />
        </div>
      ) : (
        <div className={`w-full h-44 shrink-0 bg-gradient-to-br ${
          getCategoryBySlug(a.category)?.color ?? 'from-surface-raised to-surface'
        } flex items-center justify-center`}>
          {cat ? <CategoryIcon slug={cat.slug} className="w-8 h-8 text-accent-text opacity-40" /> : <span className="text-4xl opacity-40">📄</span>}
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        {cat && (
          <span className="flex items-center gap-1 text-xs font-medium text-eyebrow uppercase tracking-widest mb-3">
            <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text" /> {cat.label}
          </span>
        )}
        <h2 className="text-base font-bold leading-snug text-prose group-hover:text-accent-text-soft transition-colors flex-1">
          {a.title}
        </h2>
        {a.excerpt && (
          <p className="text-prose-muted text-sm mt-2 line-clamp-2">{a.excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4">
          <span className="text-xs text-prose-faint">
            {a.published_at
              ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </span>
          <div className="flex items-center gap-3">
            {a.reading_time_minutes && (
              <span className="text-xs text-prose-faint">{a.reading_time_minutes} min read</span>
            )}
            <span className="text-xs text-accent-text font-medium">Read guide</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
