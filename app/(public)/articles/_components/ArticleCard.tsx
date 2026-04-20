import Link from 'next/link'
import Image from 'next/image'
import { getCategoryBySlug } from '@/lib/categories'
import type { ArticleRow } from '../actions'

export default function ArticleCard({ article: a, priority = false }: { article: ArticleRow; priority?: boolean }) {
  const cat = getCategoryBySlug(a.category)
  return (
    <Link
      href={`/articles/${a.slug}`}
      className="group flex flex-col bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-orange-700/60 transition-all duration-200"
    >
      {a.image_url ? (
        <div className="relative w-full h-44 bg-gray-800 shrink-0 overflow-hidden">
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
          getCategoryBySlug(a.category)?.color ?? 'from-gray-800 to-gray-900'
        } flex items-center justify-center`}>
          <span className="text-4xl opacity-40">
            {getCategoryBySlug(a.category)?.icon ?? '📄'}
          </span>
        </div>
      )}
      <div className="p-5 flex flex-col flex-1">
        {cat && (
          <span className="text-xs font-medium text-orange-500 uppercase tracking-widest mb-3">
            {cat.icon} {cat.label}
          </span>
        )}
        <h2 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
          {a.title}
        </h2>
        {a.excerpt && (
          <p className="text-gray-500 text-sm mt-2 line-clamp-2">{a.excerpt}</p>
        )}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
          <span className="text-xs text-gray-600">
            {a.published_at
              ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : ''}
          </span>
          <div className="flex items-center gap-3">
            {a.reading_time_minutes && (
              <span className="text-xs text-gray-600">{a.reading_time_minutes} min read</span>
            )}
            <span className="text-xs text-orange-500 font-medium">Read →</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
